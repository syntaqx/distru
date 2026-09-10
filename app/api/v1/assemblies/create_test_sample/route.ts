import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { createTestSample, getPackage, listPackages, packageToApi } from "@/lib/modules/inventory";

type Body = { package_id?: string; package_tag?: string; quantity?: number; new_package_tag?: string };

// POST /api/v1/assemblies/create_test_sample - pull a test sample off a
// package into a new is_test_sample package, consuming it from sellable stock.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || (!body.package_id && !body.package_tag))
    return distruError(400, "package_id or package_tag is required", ["package_id"], "body");
  if (typeof body.quantity !== "number" || body.quantity <= 0)
    return distruError(400, "quantity (positive number) is required", ["quantity"], "body");

  let pkgId = body.package_id;
  if (!pkgId && body.package_tag) {
    const { items } = await listPackages(auth.ctx, { limit: 200 });
    pkgId = items.find((p) => p.packageTag === body.package_tag)?.id;
  }
  if (!pkgId || !(await getPackage(auth.ctx, pkgId)))
    return distruError(404, "Package not found", ["package_id"], "body");

  try {
    const { source, created } = await createTestSample(auth.ctx, {
      packageId: pkgId,
      quantity: body.quantity,
      newTag: body.new_package_tag,
    });
    return Response.json(
      { data: { source: packageToApi(source), package: packageToApi(created) } },
      { status: 201 },
    );
  } catch (err) {
    return distruError(422, err instanceof Error ? err.message : "Sample failed", ["quantity"], "body");
  }
}
