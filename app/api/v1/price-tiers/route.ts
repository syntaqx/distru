import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listPriceTiers, upsertPriceTier, priceTierToApi } from "@/lib/modules/sales";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listPriceTiers(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(priceTierToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> | null);
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.name) return distruError(400, "name is required", ["name"], "body");
  try {
    const { row, created } = await upsertPriceTier(auth.ctx, {
      id: body.id as string | undefined,
      name: body.name as string | undefined,
    });
    return Response.json({ data: priceTierToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
