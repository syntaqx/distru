import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  getPlant,
  listPlants,
  upsertPlant,
  plantToApi,
  type PlantPhase,
} from "@/lib/modules/cultivation";

const PHASES: PlantPhase[] = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED", "DESTROYED"];

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const phaseRaw = new URL(req.url).searchParams.get("phase");
  const phase = phaseRaw && PHASES.includes(phaseRaw as PlantPhase) ? (phaseRaw as PlantPhase) : undefined;
  const { items, total } = await listPlants(auth.ctx, {
    limit: PAGE_SIZE,
    offset,
    phase,
  });
  return listEnvelope(req, items.map(plantToApi), offset, total);
}

type PlantBody = {
  id?: string;
  plant_tag?: string;
  strain_id?: string | null;
  location_id?: string | null;
  plant_batch_id?: string | null;
  phase?: PlantPhase;
};

/** Sparse upsert, Distru-style: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as PlantBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");

  try {
    if (body.id) {
      const existing = await getPlant(auth.ctx, body.id);
      if (!existing) return distruError(404, "Plant not found", ["id"], "body");
    }
    const { row, created } = await upsertPlant(auth.ctx, {
      id: body.id,
      plantTag: body.plant_tag,
      strainId: body.strain_id,
      locationId: body.location_id,
      plantBatchId: body.plant_batch_id,
      phase: body.phase,
    });
    return Response.json({ data: plantToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Plant upsert failed", [], "body");
  }
}
