import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  listProductSubcategories,
  upsertProductSubcategory,
  productSubcategoryToApi,
} from "@/lib/modules/catalog";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listProductSubcategories(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(productSubcategoryToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.name) return distruError(400, "name is required", ["name"], "body");
  try {
    const { row, created } = await upsertProductSubcategory(auth.ctx, {
      id: body.id as string | undefined,
      name: body.name as string | undefined,
      categoryId: (body.category_id as string) ?? null,
    });
    return Response.json({ data: productSubcategoryToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
