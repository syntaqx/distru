import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  createCompany,
  getCompany,
  listCompanies,
  listCompanyGroups,
  updateCompany,
  companyToApi,
} from "@/lib/modules/catalog";
import { fromCustomData } from "@/lib/modules/shared";
import { emitEvent } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const [all, groups] = await Promise.all([
    listCompanies(auth.ctx),
    listCompanyGroups(auth.ctx),
  ]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const page = all
    .slice(offset, offset + PAGE_SIZE)
    .map((c) => companyToApi(c, c.groupId ? groupName.get(c.groupId) ?? null : null));
  return listEnvelope(req, page, offset, all.length);
}

/** Distru accepts `relationship_type` (name or {name}); we also accept `roles`. */
function bodyRoles(body: CompanyBody): string[] | undefined {
  if (body.roles) return body.roles;
  const rt = body.relationship_type;
  if (!rt) return undefined;
  const name = typeof rt === "string" ? rt : rt.name;
  return name ? [name.toUpperCase()] : undefined;
}

type CompanyBody = {
  id?: string;
  name?: string;
  roles?: string[];
  relationship_type?: string | { name?: string };
  group_id?: string | null;
  tags?: string[];
  custom_data?: unknown;
};

/** Sparse upsert, Distru-style: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as CompanyBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");

  try {
    if (body.id) {
      const existing = await getCompany(auth.ctx, body.id);
      if (!existing) return distruError(404, "Company not found", ["id"], "body");
      const updated = await updateCompany(auth.ctx, body.id, {
        name: body.name,
        roles: bodyRoles(body),
        groupId: body.group_id,
        tags: body.tags,
        customFields: fromCustomData(body.custom_data),
      });
      const api = companyToApi(updated);
      await emitEvent(auth.ctx, "company.updated", api, { id: updated.id });
      return Response.json({ data: api });
    }
    if (!body.name) return distruError(400, "name is required", ["name"], "body");
    const company = await createCompany(auth.ctx, {
      name: body.name,
      roles: bodyRoles(body),
      groupId: body.group_id ?? null,
      tags: body.tags,
      customFields: fromCustomData(body.custom_data),
    });
    const api = companyToApi(company);
    await emitEvent(auth.ctx, "company.created", api, { id: company.id });
    return Response.json({ data: api }, { status: 201 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Company upsert failed", [], "body");
  }
}
