import {
  authenticate,
  distruError,
  dateRange,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  createOrder,
  getOrder,
  listOrders,
  orderToApi,
  type OrderStatus,
} from "@/lib/modules/sales";
import type { Address, ChargeKind } from "@/lib/modules/sales";
import { getProduct, getProductBySku } from "@/lib/modules/catalog";
import { findOrCreateCustomer } from "@/lib/modules/catalog";
import { emitEvent } from "@/lib/modules/platform";
import { fromCustomData } from "@/lib/modules/shared";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const offset = pageOffset(req);
  const updated = dateRange(req, "updated_datetime");
  const status = (url.searchParams.get("status") as OrderStatus | null) ?? undefined;
  const { items, total } = await listOrders(auth.ctx, {
    status,
    search: url.searchParams.get("search") ?? undefined,
    updatedFrom: updated.from,
    updatedTo: updated.to,
    limit: PAGE_SIZE,
    offset,
  });
  const withItems = await Promise.all(items.map((o) => getOrder(auth.ctx, o.order.id)));
  return listEnvelope(req, withItems.filter((o) => o != null).map((o) => orderToApi(o!)), offset, total);
}

type LineBody = {
  product_id?: string;
  sku?: string;
  quantity: number;
  unit_price?: number;
};

type ChargeBody = { name: string; kind?: ChargeKind; amount: number };
type OrderBody = {
  customer_id?: string;
  customer?: string;
  location_id?: string;
  status?: OrderStatus;
  notes?: string;
  charges?: ChargeBody[];
  billing_address?: Address;
  shipping_address?: Address;
  tags?: string[];
  custom_data?: unknown;
  items: LineBody[];
};

/** Create a sales order. Lines match a product by id or SKU. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as OrderBody | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0)
    return distruError(400, "items (non-empty array) is required", ["items"], "body");
  if (
    body.status &&
    !["PENDING", "PROCESSING", "READY_TO_SHIP", "DELIVERING", "DELIVERED", "COMPLETED"].includes(body.status)
  )
    return distruError(400, `Invalid status "${body.status}"`, ["status"], "body");

  let customerId = body.customer_id ?? null;
  if (!customerId && body.customer)
    customerId = (await findOrCreateCustomer(auth.ctx, body.customer)).id;

  const lines = [];
  for (const [i, line] of body.items.entries()) {
    const product = line.product_id
      ? await getProduct(auth.ctx, line.product_id)
      : line.sku
        ? await getProductBySku(auth.ctx, line.sku)
        : null;
    if (!product)
      return distruError(
        400,
        `Unknown product ${line.product_id ?? line.sku}`,
        ["items", i, line.product_id ? "product_id" : "sku"],
        "body",
      );
    lines.push({
      productId: product.product.id,
      sku: product.product.sku,
      name: product.product.name,
      quantity: line.quantity,
      unitPrice: line.unit_price ?? Number(product.product.unitPrice ?? 0),
    });
  }

  try {
    const order = await createOrder(auth.ctx, {
      customerId,
      locationId: body.location_id ?? null,
      status: body.status ?? "PROCESSING",
      notes: body.notes ?? null,
      charges: body.charges,
      billingAddress: body.billing_address ?? null,
      shippingAddress: body.shipping_address ?? null,
      tags: body.tags,
      customFields: fromCustomData(body.custom_data),
      items: lines,
    });
    const api = orderToApi(order);
    await emitEvent(auth.ctx, "order.created", api, { id: order.order.id });
    return Response.json({ data: api }, { status: 201 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Order creation failed", [], "body");
  }
}
