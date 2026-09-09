import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listBatches, upsertBatch, batchToApi } from "@/lib/modules/inventory";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listBatches(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(batchToApi), offset, total);
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
      productId: (body.product_id as string) ?? null,
    });
    return Response.json({ data: batchToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
