import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { addProductCosts, getPackage, listPackages } from "@/lib/modules/inventory";

type CostEntry = { quantity?: number; cost_per_unit?: number; amount?: number };
type Body = { package_id?: string; package_tag?: string; costs?: CostEntry[] };

function totalOf(costs: CostEntry[] = []): number {
  return costs.reduce(
    (s, c) => s + (c.amount ?? (Number(c.quantity ?? 1) * Number(c.cost_per_unit ?? 0))),
    0,
  );
}

// POST /api/v1/packages/add-costs - allocate landed costs onto the package's
// product lots (raising cost basis / COGS).
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || (!body.package_id && !body.package_tag))
    return distruError(400, "package_id or package_tag is required", ["package_id"], "body");
  let pkgId = body.package_id;
  if (!pkgId && body.package_tag) {
    const { items } = await listPackages(auth.ctx, { limit: 200 });
    pkgId = items.find((p) => p.packageTag === body.package_tag)?.id;
  }
  const pkg = pkgId ? await getPackage(auth.ctx, pkgId) : null;
  if (!pkg?.productId) return distruError(404, "Package (with a product) not found", ["package_id"], "body");

  const total = totalOf(body.costs);
  const result = await addProductCosts(auth.ctx, pkg.productId, total);
  return Response.json({
    data: { package_id: pkg.id, total_cost: total, lots_recosted: result.lotsUpdated },
  });
}
