import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listCosts, upsertCost, costToApi } from "@/lib/modules/manufacturing";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listCosts(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(costToApi), offset, total);
}

/** Sparse upsert: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as {
    id?: string;
    assembly_id?: string | null;
    cost_type_id?: string | null;
    description?: string | null;
    amount?: number;
  } | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && (body.amount === undefined || body.amount === null))
    return distruError(400, "amount is required", ["amount"], "body");
  try {
    const { row, created } = await upsertCost(auth.ctx, {
      id: body.id,
      assemblyId: body.assembly_id,
      costTypeId: body.cost_type_id,
      description: body.description,
      amount: body.amount,
    });
    return Response.json({ data: costToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
