import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listAssemblies, upsertAssembly, assemblyToApi, getAssembly } from "@/lib/modules/manufacturing";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listAssemblies(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(assemblyToApi), offset, total);
}

/** Sparse upsert: omit id to create (auto-numbered), include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  try {
    const { row, created } = await upsertAssembly(auth.ctx, body as never);
    const full = (await getAssembly(auth.ctx, row.id))!;
    return Response.json({ data: assemblyToApi(full) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
