import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listCompanyGroups, upsertCompanyGroup, companyGroupToApi } from "@/lib/modules/catalog";
import { emitEvent } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const all = await listCompanyGroups(auth.ctx);
  const data = all.slice(offset, offset + PAGE_SIZE).map(companyGroupToApi);
  return listEnvelope(req, data, offset, all.length);
}

/** Sparse upsert: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as { id?: string; name?: string } | null;
  if (!body?.name) return distruError(400, "name is required", ["name"], "body");
  try {
    const { row, created } = await upsertCompanyGroup(auth.ctx, { id: body.id, name: body.name });
    const api = companyGroupToApi(row);
    await emitEvent(auth.ctx, created ? "company_group.created" : "company_group.updated", api, { id: row.id });
    return Response.json({ data: api }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Company group upsert failed", [], "body");
  }
}
