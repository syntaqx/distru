import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listCostTypes, upsertCostType, costTypeToApi } from "@/lib/modules/manufacturing";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listCostTypes(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(costTypeToApi), offset, total);
}

/** Sparse upsert: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as { id?: string; name?: string } | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.name) return distruError(400, "name is required", ["name"], "body");
  try {
    const { row, created } = await upsertCostType(auth.ctx, { id: body.id, name: body.name });
    return Response.json({ data: costTypeToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
