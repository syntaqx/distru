import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getProduct, getProductBySku } from "@/lib/modules/catalog";
import { addProductCosts } from "@/lib/modules/inventory";

type CostEntry = { quantity?: number; cost_per_unit?: number; amount?: number };
type Body = { product_id?: string; sku?: string; costs?: CostEntry[] };

/** Total of a cost-entry list: sum(quantity × cost_per_unit) or sum(amount). */
function totalOf(costs: CostEntry[] = []): number {
  return costs.reduce(
    (s, c) => s + (c.amount ?? (Number(c.quantity ?? 1) * Number(c.cost_per_unit ?? 0))),
    0,
  );
}

// POST /public/v1/products/add-costs - allocate landed costs onto a product's
// open inventory lots (raising cost basis / COGS).
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || (!body.product_id && !body.sku))
    return distruError(400, "product_id or sku is required", ["product_id"], "body");
  const product = body.product_id
    ? await getProduct(auth.ctx, body.product_id)
    : await getProductBySku(auth.ctx, body.sku!);
  if (!product) return distruError(404, "Product not found", ["product_id"], "body");

  const total = totalOf(body.costs);
  const result = await addProductCosts(auth.ctx, product.product.id, total);
  return Response.json({
    data: { product_id: product.product.id, total_cost: total, lots_recosted: result.lotsUpdated },
  });
}
