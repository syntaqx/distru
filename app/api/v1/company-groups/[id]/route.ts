import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getCompanyGroup, companyGroupToApi } from "@/lib/modules/catalog";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const group = await getCompanyGroup(auth.ctx, id);
  if (!group) return distruError(404, "Company group not found", ["id"], "path");
  return Response.json({ data: companyGroupToApi(group) });
}
