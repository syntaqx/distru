import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageNumber,
  requireScope,
} from "@/lib/public-api";
import { createCompany, listCompanies } from "@/lib/services/reference";
import { datetime } from "@/lib/services/serialize";

type Company = { id: string; name: string; roles: string[]; createdAt: Date; updatedAt: Date };

function toApi(c: Company) {
  return {
    id: c.id,
    name: c.name,
    roles: c.roles,
    created_datetime: datetime(c.createdAt),
    updated_datetime: datetime(c.updatedAt),
  };
}

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const page = pageNumber(req);
  const all = await listCompanies(auth.ctx);
  const start = (page - 1) * PAGE_SIZE;
  return listEnvelope(req, all.slice(start, start + PAGE_SIZE).map(toApi), page, all.length);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    roles?: string[];
  } | null;
  if (!body?.name) return distruError(400, "name is required", ["name"]);
  const company = await createCompany(auth.ctx, { name: body.name, roles: body.roles });
  return Response.json({ data: toApi(company as Company) }, { status: 201 });
}
