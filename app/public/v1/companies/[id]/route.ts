import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getCompany, companyToApi } from "@/lib/modules/catalog";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const c = await getCompany(auth.ctx, id);
  if (!c) return distruError(404, "Company not found", ["id"], "path");
  return Response.json({ data: companyToApi(c) });
}
