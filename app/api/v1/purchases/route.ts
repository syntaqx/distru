import {
  authenticate,
  dateRange,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  purchaseOrderToApi,
  type PurchaseOrderStatus,
} from "@/lib/modules/purchasing";
import { getProduct, getProductBySku, findOrCreateVendor } from "@/lib/modules/catalog";
import { emitEvent } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "purchase_orders:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const offset = pageOffset(req);
  const updated = dateRange(req, "updated_datetime");
  const status = (url.searchParams.get("status") as PurchaseOrderStatus | null) ?? undefined;
  const { items, total } = await listPurchaseOrders(auth.ctx, {
    status,
    search: url.searchParams.get("search") ?? undefined,
    updatedFrom: updated.from,
    updatedTo: updated.to,
    limit: PAGE_SIZE,
    offset,
  });
  const withItems = await Promise.all(items.map((p) => getPurchaseOrder(auth.ctx, p.purchaseOrder.id)));
  return listEnvelope(
    req,
    withItems.filter((p) => p != null).map((p) => purchaseOrderToApi(p!)),
    offset,
    total,
  );
}

type LineBody = { product_id?: string; sku?: string; quantity: number; unit_cost?: number };
type PurchaseOrderBody = {
  vendor_id?: string;
  vendor?: string;
  location_id?: string;
  status?: PurchaseOrderStatus;
  notes?: string;
  items: LineBody[];
};

/** Create a purchase order. Lines match a product by id or SKU; RECEIVED adds stock. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "purchase_orders:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as PurchaseOrderBody | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0)
    return distruError(400, "items (non-empty array) is required", ["items"], "body");
  if (body.status && !["DRAFT", "OPEN", "RECEIVED"].includes(body.status))
    return distruError(400, `Invalid status "${body.status}"`, ["status"], "body");

  let vendorId = body.vendor_id ?? null;
  if (!vendorId && body.vendor) vendorId = (await findOrCreateVendor(auth.ctx, body.vendor)).id;

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
      unitCost: line.unit_cost ?? 0,
    });
  }

  try {
    const po = await createPurchaseOrder(auth.ctx, {
      vendorId,
      locationId: body.location_id ?? null,
      status: body.status ?? "OPEN",
      notes: body.notes ?? null,
      items: lines,
    });
    const api = purchaseOrderToApi(po);
    await emitEvent(auth.ctx, "purchase_order.created", api, { id: po.purchaseOrder.id });
    return Response.json({ data: api }, { status: 201 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Purchase order creation failed", [], "body");
  }
}
