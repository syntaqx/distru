import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { finishPackage, getPackage, listPackages, packageToApi } from "@/lib/modules/inventory";

type Body = { id?: string; package_tag?: string; package_ids?: string[]; finished_datetime?: string };

// POST /public/v1/packages/finish - mark one or more packages finished (Metrc's
// terminal state), issuing remaining quantity out. Bulk via `package_ids[]`
// (Distru's FinishPackagesRequest) or single via `id`/`package_tag`.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");

  let ids = body.package_ids ?? [];
  if (ids.length === 0) {
    let pkgId = body.id;
    if (!pkgId && body.package_tag) {
      const { items } = await listPackages(auth.ctx, { limit: 200 });
      pkgId = items.find((p) => p.packageTag === body.package_tag)?.id;
    }
    if (!pkgId) return distruError(400, "id, package_tag, or package_ids is required", ["id"], "body");
    ids = [pkgId];
  }

  const finished = [];
  for (const id of ids) {
    if (!(await getPackage(auth.ctx, id)))
      return distruError(404, `Package ${id} not found`, ["package_ids"], "body");
    finished.push(packageToApi(await finishPackage(auth.ctx, id)));
  }
  return Response.json({ data: finished });
}
