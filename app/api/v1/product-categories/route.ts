import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { createCategory, listCategories } from "@/lib/modules/catalog";
import { datetime } from "@/lib/modules/shared";
import { emitEvent } from "@/lib/modules/platform";

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
    inserted_datetime: datetime(c.createdAt),
    updated_datetime: datetime(c.updatedAt),
  };
}

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const all = await listCategories(auth.ctx);
  return listEnvelope(req, all.slice(offset, offset + PAGE_SIZE).map(toApi), offset, all.length);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  if (!body?.name) return distruError(400, "name is required", ["name"], "body");
  const category = await createCategory(auth.ctx, { name: body.name });
  const api = toApi(category as Category);
  await emitEvent(auth.ctx, "category.created", api, { id: category.id });
  return Response.json({ data: api }, { status: 201 });
}
