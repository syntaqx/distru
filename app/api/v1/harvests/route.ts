import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  getHarvest,
  listHarvests,
  upsertHarvest,
  harvestToApi,
  type HarvestStatus,
} from "@/lib/modules/cultivation";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listHarvests(auth.ctx, {
    limit: PAGE_SIZE,
    offset,
  });
  return listEnvelope(req, items.map(harvestToApi), offset, total);
}

type HarvestBody = {
  id?: string;
  harvest_number?: string;
  name?: string | null;
  strain_id?: string | null;
  location_id?: string | null;
  plant_count?: number;
  wet_weight?: string | number | null;
  dry_weight?: string | number | null;
  status?: HarvestStatus;
};

/** Sparse upsert, Distru-style: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as HarvestBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");

  try {
    if (body.id) {
      const existing = await getHarvest(auth.ctx, body.id);
      if (!existing) return distruError(404, "Harvest not found", ["id"], "body");
    }
    const { row, created } = await upsertHarvest(auth.ctx, {
      id: body.id,
      harvestNumber: body.harvest_number,
      name: body.name,
      strainId: body.strain_id,
      locationId: body.location_id,
      plantCount: body.plant_count,
      wetWeight: body.wet_weight,
      dryWeight: body.dry_weight,
      status: body.status,
    });
    return Response.json({ data: harvestToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Harvest upsert failed", [], "body");
  }
}
