import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getProduct, getProductBySku } from "@/lib/modules/catalog";
import {
  findOrCreateLocation,
  getDefaultLocation,
} from "@/lib/modules/catalog";
import { adjustInventory } from "@/lib/modules/inventory";
import { emitEvent } from "@/lib/modules/platform";
import { num } from "@/lib/modules/shared";

type Body = {
  product_id?: string;
  sku?: string;
  location?: string;
  quantity_delta: number;
  reason?: string;
};

/** Create a stock adjustment (inventory movement). Mirrors Distru's Make module. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.quantity_delta !== "number" || !Number.isFinite(body.quantity_delta))
    return distruError(400, "quantity_delta (number) is required", ["quantity_delta"], "body");
  if (!body.product_id && !body.sku)
    return distruError(400, "product_id or sku is required", ["product_id"], "body");

  const identifier = body.product_id ? "product_id" : "sku";
  const product = body.product_id
    ? await getProduct(auth.ctx, body.product_id)
    : await getProductBySku(auth.ctx, body.sku!);
  if (!product) return distruError(404, "Product not found", [identifier], "body");

  const location = body.location
    ? await findOrCreateLocation(auth.ctx, body.location)
    : await getDefaultLocation(auth.ctx);

  const { onHand } = await adjustInventory(auth.ctx, {
    productId: product.product.id,
    locationId: location.id,
    delta: body.quantity_delta,
    reason: body.reason,
  });

  const data = {
    product_id: product.product.id,
    sku: product.product.sku,
    location: location.name,
    quantity_delta: num(body.quantity_delta),
    on_hand: num(onHand),
  };
  await emitEvent(auth.ctx, "inventory.adjusted", data, { id: product.product.id });
  return Response.json({ data }, { status: 201 });
}
