import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getProductGroup, productGroupToApi } from "@/lib/modules/catalog";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getProductGroup(auth.ctx, id);
  if (!row) return distruError(404, "Product group not found", ["id"], "path");
  return Response.json({ data: productGroupToApi(row) });
}
