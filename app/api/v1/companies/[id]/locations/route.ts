import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getCompany, listLocations } from "@/lib/modules/catalog";

// GET /api/v1/companies/{id}/locations - list a company's locations.
//
// Locations are modeled org-scoped in this clone (the schema has no companyId),
// so we validate the company exists and return the organization's locations.
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
  const locations = await listLocations(auth.ctx);
  return Response.json({
    data: locations.map((l) => ({ id: l.id, name: l.name })),
  });
}
