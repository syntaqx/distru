import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  inventoryValueByProduct,
  listPackages,
  upsertPackage,
  packageToApi,
} from "@/lib/modules/inventory";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listPackages(auth.ctx, { limit: PAGE_SIZE, offset });
  // Cost per package = the product's FIFO average cost × the package quantity.
  const value = await inventoryValueByProduct(auth.ctx);
  const data = items.map((p) => {
    const v = p.productId ? value.get(p.productId) : undefined;
    const perUnit = v && v.qty > 0 ? v.value / v.qty : 0;
    return packageToApi(p, { perUnit, total: perUnit * Number(p.quantity ?? 0) });
  });
  return listEnvelope(req, data, offset, total);
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
      batchId: (body.batch_id as string) ?? null,
      quantity: body.quantity as string | number | undefined,
      status: body.status as string | undefined,
      barcode: (body.barcode as string) ?? null,
      metrcTag: ((body.metrc_tag ?? body.compliance_label) as string) ?? null,
      labTestingState: (body.lab_testing_state as string) ?? null,
    });
    return Response.json({ data: packageToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
