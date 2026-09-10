import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getTag, tagToApi } from "@/lib/modules/catalog";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getTag(auth.ctx, id);
  if (!row) return distruError(404, "Tag not found", ["id"], "path");
  return Response.json({ data: tagToApi(row) });
}
