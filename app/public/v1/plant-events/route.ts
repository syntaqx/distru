import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  listPlantEvents,
  logPlantEvent,
  plantEventToApi,
  PLANT_EVENT_TYPES,
  type PlantEventType,
} from "@/lib/modules/cultivation";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const url = new URL(req.url);
  const plantId = url.searchParams.get("plant_id") ?? undefined;
  const plantBatchId = url.searchParams.get("plant_batch_id") ?? undefined;
  const offset = pageOffset(req);
  const { items, total } = await listPlantEvents(auth.ctx, {
    plantId,
    plantBatchId,
    limit: PAGE_SIZE,
    offset,
  });
  return listEnvelope(req, items.map(plantEventToApi), offset, total);
}

type PlantEventBody = {
  plant_id?: string | null;
  plant_batch_id?: string | null;
  type?: string;
  note?: string | null;
  detail?: string | null;
  occurred_at?: string | null;
};

/** Append a lifecycle event to a plant or plant batch. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as PlantEventBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.plant_id && !body.plant_batch_id)
    return distruError(400, "One of plant_id or plant_batch_id is required", ["plant_id"], "body");
  if (!body.type || !PLANT_EVENT_TYPES.includes(body.type as PlantEventType))
    return distruError(
      400,
      `type must be one of: ${PLANT_EVENT_TYPES.join(", ")}`,
      ["type"],
      "body",
    );

  try {
    const row = await logPlantEvent(auth.ctx, {
      plantId: body.plant_id ?? null,
      plantBatchId: body.plant_batch_id ?? null,
      type: body.type as PlantEventType,
      note: body.note ?? null,
      detail: body.detail ?? null,
      occurredAt: body.occurred_at ? new Date(body.occurred_at) : null,
    });
    return Response.json({ data: plantEventToApi(row) }, { status: 201 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Plant event failed", [], "body");
  }
}
