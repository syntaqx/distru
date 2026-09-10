import {
  authenticate,
  distruError,
  listEnvelope,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { getProduct, getProductBySku, findOrCreateLocation, getDefaultLocation } from "@/lib/modules/catalog";
import {
  adjustInventory,
  getBatch,
  getPackage,
  listAdjustments,
} from "@/lib/modules/inventory";
import { emitEvent } from "@/lib/modules/platform";
import { datetime, num } from "@/lib/modules/shared";

/** GET /public/v1/adjustments — list inventory movements (Distru StockAdjustments). */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listAdjustments(auth.ctx, { offset });
  const data = items.map((r) => ({
    id: r.id,
    product_id: r.productId,
    location_id: r.locationId,
    quantity: num(r.quantityDelta),
    quantity_delta: num(r.quantityDelta),
    unit_cost: num(r.unitCost),
    reason: r.reason,
    source: r.refType ?? null,
    inserted_datetime: datetime(r.createdAt),
  }));
  return listEnvelope(req, data, offset, total);
}

type Body = {
  product_id?: string;
  sku?: string;
  package_id?: string;
  batch_id?: string;
  location?: string;
  quantity_delta?: number;
  quantity?: number;
  unit_cost?: number;
  reason?: string;
  completion_datetime?: string;
};

/**
 * Create a stock adjustment (inventory movement). Accepts a target by
 * `product_id`/`sku`, or by `package_id`/`batch_id` (resolved to their product),
 * a signed `quantity_delta` (or Distru's `quantity`), and an optional `unit_cost`
 * (the cost layer opened on a positive adjustment).
 */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  const delta = body?.quantity_delta ?? body?.quantity;
  if (!body || typeof delta !== "number" || !Number.isFinite(delta))
    return distruError(400, "quantity_delta (or quantity) is required", ["quantity_delta"], "body");

  // Resolve the target product + a default location from a product, package, or batch.
  let productId: string | undefined;
  let sku: string | null = null;
  let locationId: string | undefined;
  if (body.package_id) {
    const pkg = await getPackage(auth.ctx, body.package_id);
    if (!pkg?.productId) return distruError(404, "Package (with a product) not found", ["package_id"], "body");
    productId = pkg.productId;
    locationId = pkg.locationId ?? undefined;
  } else if (body.batch_id) {
    const batch = await getBatch(auth.ctx, body.batch_id);
    if (!batch?.productId) return distruError(404, "Batch (with a product) not found", ["batch_id"], "body");
    productId = batch.productId;
  } else if (body.product_id || body.sku) {
    const product = body.product_id
      ? await getProduct(auth.ctx, body.product_id)
      : await getProductBySku(auth.ctx, body.sku!);
    if (!product) return distruError(404, "Product not found", ["product_id"], "body");
    productId = product.product.id;
    sku = product.product.sku;
  } else {
    return distruError(400, "product_id, sku, package_id, or batch_id is required", ["product_id"], "body");
  }

  const location = locationId
    ? { id: locationId, name: "" }
    : body.location
      ? await findOrCreateLocation(auth.ctx, body.location)
      : await getDefaultLocation(auth.ctx);

  const { onHand } = await adjustInventory(auth.ctx, {
    productId: productId!,
    locationId: location.id,
    delta,
    reason: body.reason,
    ...(body.unit_cost != null ? { unitCost: body.unit_cost } : {}),
  });

  const data = {
    product_id: productId!,
    sku,
    location: location.name || null,
    quantity_delta: num(delta),
    unit_cost: body.unit_cost != null ? num(body.unit_cost) : null,
    on_hand: num(onHand),
  };
  await emitEvent(auth.ctx, "inventory.adjusted", data, { id: productId! });
  return Response.json({ data }, { status: 201 });
}
