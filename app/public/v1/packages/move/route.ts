import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { findOrCreateLocation } from "@/lib/modules/catalog";
import {
  getPackage,
  listPackages,
  movePackage,
  packageToApi,
  InsufficientStockError,
} from "@/lib/modules/inventory";

type Body = {
  id?: string;
  package_tag?: string;
  package_ids?: string[];
  to_location_id?: string;
  location_id?: string;
  location?: string;
};

// POST /public/v1/packages/move - move one or more packages to another location.
// Bulk via `package_ids[]` (Distru's MovePackagesRequest) or single via
// `id`/`package_tag`. Destination via `location_id`/`to_location_id`/`location`.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.to_location_id && !body.location_id && !body.location)
    return distruError(400, "location_id or location is required", ["location_id"], "body");

  const toLocationId =
    body.to_location_id ??
    body.location_id ??
    (body.location ? (await findOrCreateLocation(auth.ctx, body.location)).id : null);
  if (!toLocationId) return distruError(400, "destination location is required", ["location_id"], "body");

  // Resolve the target package id(s).
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

  try {
    const moved = [];
    for (const id of ids) {
      if (!(await getPackage(auth.ctx, id)))
        return distruError(404, `Package ${id} not found`, ["package_ids"], "body");
      moved.push(packageToApi(await movePackage(auth.ctx, id, toLocationId)));
    }
    return Response.json({ data: moved });
  } catch (err) {
    if (err instanceof InsufficientStockError)
      return distruError(422, err.message, ["package_ids"], "body");
    throw err;
  }
}
