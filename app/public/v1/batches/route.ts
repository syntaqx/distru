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
  listBatches,
  upsertBatch,
  batchToApi,
} from "@/lib/modules/inventory";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listBatches(auth.ctx, { limit: PAGE_SIZE, offset });
  const value = await inventoryValueByProduct(auth.ctx);
  const data = items.map((b) => {
    const v = b.productId ? value.get(b.productId) : undefined;
    const perUnit = v && v.qty > 0 ? v.value / v.qty : 0;
    return batchToApi(b, { perUnit, total: perUnit * Number(b.quantity ?? 0) });
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
  if (!body.id && !body.batch_number)
    return distruError(400, "batch_number is required", ["batch_number"], "body");
  try {
    const { row, created } = await upsertBatch(auth.ctx, {
      id: body.id as string | undefined,
      batchNumber: body.batch_number as string | undefined,
      name: (body.name as string) ?? null,
      productId: (body.product_id as string) ?? null,
      quantity: body.quantity_active as string | number | undefined,
      thc: body.thc as string | number | undefined,
      cbd: body.cbd as string | number | undefined,
    });
    return Response.json({ data: batchToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
