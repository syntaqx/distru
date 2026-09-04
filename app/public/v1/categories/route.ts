import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageNumber,
  requireScope,
} from "@/lib/public-api";
import { createCategory, listCategories } from "@/lib/services/reference";
import { datetime } from "@/lib/services/serialize";

type Category = {
  id: string;
  name: string;
  biotrackType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toApi(c: Category) {
  return {
    id: c.id,
    name: c.name,
    biotrack_type: c.biotrackType,
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
  const all = await listCategories(auth.ctx);
  const start = (page - 1) * PAGE_SIZE;
  return listEnvelope(req, all.slice(start, start + PAGE_SIZE).map(toApi), page, all.length);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  if (!body?.name) return distruError(400, "name is required", ["name"]);
  const category = await createCategory(auth.ctx, { name: body.name });
  return Response.json({ data: toApi(category as Category) }, { status: 201 });
}
