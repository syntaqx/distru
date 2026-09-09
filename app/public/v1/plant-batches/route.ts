import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  getPlantBatch,
  listPlantBatches,
  upsertPlantBatch,
  plantBatchToApi,
  type PlantPhase,
} from "@/lib/modules/cultivation";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listPlantBatches(auth.ctx, {
    limit: PAGE_SIZE,
    offset,
  });
  return listEnvelope(req, items.map(plantBatchToApi), offset, total);
}

type PlantBatchBody = {
  id?: string;
  batch_number?: string;
  strain_id?: string | null;
  location_id?: string | null;
  count?: number;
  phase?: PlantPhase;
  source_type?: string | null;
};

/** Sparse upsert, Distru-style: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as PlantBatchBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");

  try {
    if (body.id) {
      const existing = await getPlantBatch(auth.ctx, body.id);
      if (!existing) return distruError(404, "Plant batch not found", ["id"], "body");
    }
    const { row, created } = await upsertPlantBatch(auth.ctx, {
      id: body.id,
      batchNumber: body.batch_number,
      strainId: body.strain_id,
      locationId: body.location_id,
      count: body.count,
      phase: body.phase,
      sourceType: body.source_type,
    });
    return Response.json({ data: plantBatchToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Plant batch upsert failed", [], "body");
  }
}
