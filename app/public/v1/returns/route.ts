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
  createReturn,
  getReturn,
  getOrderByNumber,
  listReturns,
  returnToApi,
  type ReturnStatus,
} from "@/lib/modules/sales";
import { getProduct, getProductBySku, findOrCreateCustomer } from "@/lib/modules/catalog";
import { emitEvent } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "returns:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const offset = pageOffset(req);
  const updated = dateRange(req, "updated_datetime");
  const status = (url.searchParams.get("status") as ReturnStatus | null) ?? undefined;
  const { items, total } = await listReturns(auth.ctx, {
    status,
    search: url.searchParams.get("search") ?? undefined,
    updatedFrom: updated.from,
    updatedTo: updated.to,
    limit: PAGE_SIZE,
    offset,
  });
  const withItems = await Promise.all(items.map((r) => getReturn(auth.ctx, r.return.id)));
  return listEnvelope(
    req,
    withItems.filter((r) => r != null).map((r) => returnToApi(r!)),
    offset,
    total,
  );
}

type LineBody = { product_id?: string; sku?: string; quantity: number; unit_price?: number };
type ReturnBody = {
  customer_id?: string;
  customer?: string;
  order_number?: string;
  location_id?: string;
  status?: ReturnStatus;
  reason?: string;
  notes?: string;
  items: LineBody[];
};

/** Create a customer return. Lines match a product by id or SKU; RECEIVED restocks. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "returns:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as ReturnBody | null;
  if (!body || !Array.isArray(body.items) || body.items.length === 0)
    return distruError(400, "items (non-empty array) is required", ["items"], "body");
  if (body.status && !["DRAFT", "RECEIVED"].includes(body.status))
    return distruError(400, `Invalid status "${body.status}"`, ["status"], "body");

  let customerId = body.customer_id ?? null;
  if (!customerId && body.customer) customerId = (await findOrCreateCustomer(auth.ctx, body.customer)).id;

  let orderId: string | null = null;
  if (body.order_number) {
    const order = await getOrderByNumber(auth.ctx, body.order_number);
    if (!order) return distruError(404, `Unknown order ${body.order_number}`, ["order_number"], "body");
    orderId = order.order.id;
    if (!customerId) customerId = order.order.customerId ?? null;
  }

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
    const ret = await createReturn(auth.ctx, {
      orderId,
      customerId,
      locationId: body.location_id ?? null,
      status: body.status ?? "RECEIVED",
      reason: body.reason ?? null,
      notes: body.notes ?? null,
      items: lines,
    });
    const api = returnToApi(ret);
    await emitEvent(auth.ctx, "return.created", api, { id: ret.return.id });
    return Response.json({ data: api }, { status: 201 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Return creation failed", [], "body");
  }
}
