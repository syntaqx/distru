import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { addProductCosts, getBatch } from "@/lib/modules/inventory";

type CostEntry = { quantity?: number; cost_per_unit?: number; amount?: number };
type Body = { batch_id?: string; costs?: CostEntry[] };

function totalOf(costs: CostEntry[] = []): number {
  return costs.reduce(
    (s, c) => s + (c.amount ?? (Number(c.quantity ?? 1) * Number(c.cost_per_unit ?? 0))),
    0,
  );
}

// POST /api/v1/batches/add-costs - allocate landed costs onto the batch's
// product lots (raising cost basis / COGS).
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.batch_id)
    return distruError(400, "batch_id is required", ["batch_id"], "body");
  const batch = await getBatch(auth.ctx, body.batch_id);
  if (!batch?.productId) return distruError(404, "Batch (with a product) not found", ["batch_id"], "body");

  const total = totalOf(body.costs);
  const result = await addProductCosts(auth.ctx, batch.productId, total);
  return Response.json({
    data: { batch_id: batch.id, total_cost: total, lots_recosted: result.lotsUpdated },
  });
}
