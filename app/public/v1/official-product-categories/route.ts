import {
  authenticate,
  listEnvelope,
  requireScope,
} from "@/lib/public-api";
import {
  listOfficialProductCategories,
  officialProductCategoryToApi,
} from "@/lib/modules/catalog";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const all = await listOfficialProductCategories();
  return listEnvelope(req, all.map(officialProductCategoryToApi), 0, all.length);
}
