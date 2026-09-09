import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listPackages, upsertPackage, packageToApi } from "@/lib/modules/inventory";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listPackages(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(packageToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.package_tag)
    return distruError(400, "package_tag is required", ["package_tag"], "body");
  try {
    const { row, created } = await upsertPackage(auth.ctx, {
      id: body.id as string | undefined,
      packageTag: body.package_tag as string | undefined,
      productId: (body.product_id as string) ?? null,
      locationId: (body.location_id as string) ?? null,
      quantity: body.quantity as string | number | undefined,
      status: body.status as string | undefined,
    });
    return Response.json({ data: packageToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
