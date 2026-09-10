import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getCompany } from "@/lib/modules/catalog";
import { licenseToApi, listCompanyLicenses, listLicenseTypes } from "@/lib/modules/compliance";

// GET /api/v1/companies/{id}/licenses - list a company's own licenses.
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
  const [items, types] = await Promise.all([
    listCompanyLicenses(auth.ctx, id),
    listLicenseTypes(auth.ctx, { limit: 200 }),
  ]);
  const typeName = new Map(types.items.map((t) => [t.id, t.name]));
  return Response.json({
    data: items.map((l) => licenseToApi(l, l.licenseTypeId ? typeName.get(l.licenseTypeId) : null)),
  });
}
