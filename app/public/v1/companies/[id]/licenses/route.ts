import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getCompany } from "@/lib/modules/catalog";
import { licenseToApi, listLicenses } from "@/lib/modules/compliance";

// GET /public/v1/companies/{id}/licenses - list a company's licenses.
//
// Licenses are modeled org-scoped in this clone (the schema has no companyId),
// so `listLicenses` takes no company filter. We validate the company exists and
// return the organization's licenses.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const company = await getCompany(auth.ctx, id);
  if (!company) return distruError(404, "Company not found", ["id"], "path");
  const { items } = await listLicenses(auth.ctx, { limit: 200 });
  return Response.json({ data: items.map(licenseToApi) });
}
