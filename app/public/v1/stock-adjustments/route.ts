import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getProduct, getProductBySku } from "@/lib/services/products";
import {
  findOrCreateLocation,
  getDefaultLocation,
} from "@/lib/services/reference";
import { adjustInventory } from "@/lib/services/inventory";

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
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.quantity_delta !== "number")
    return distruError(400, "quantity_delta (number) is required", ["quantity_delta"]);

  const product = body.product_id
    ? await getProduct(auth.ctx, body.product_id)
    : body.sku
      ? await getProductBySku(auth.ctx, body.sku)
      : null;
  if (!product) return distruError(404, "Product not found", ["product_id"]);

  const location = body.location
    ? await findOrCreateLocation(auth.ctx, body.location)
    : await getDefaultLocation(auth.ctx);

  const { onHand } = await adjustInventory(auth.ctx, {
    productId: product.product.id,
    locationId: location.id,
    delta: body.quantity_delta,
    reason: body.reason,
  });

  return Response.json(
    {
      data: {
        product_id: product.product.id,
        sku: product.product.sku,
        location: location.name,
        quantity_delta: String(body.quantity_delta),
        on_hand: String(onHand),
      },
    },
    { status: 201 },
  );
}
