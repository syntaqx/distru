import { db } from "@/db";
import { plantBatches } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, recordAudit } from "@/lib/modules/shared";
import { and, count, desc, eq } from "drizzle-orm";
import { logPlantEvent } from "./plant-events";

type Row = typeof plantBatches.$inferSelect;
export type PlantPhase = "IMMATURE" | "VEGETATIVE" | "FLOWERING" | "HARVESTED" | "DESTROYED";

/** Forward lifecycle for advancing a batch (DESTROYED is a manual terminal). */
export const PLANT_BATCH_PHASE_ORDER: PlantPhase[] = [
  "IMMATURE",
  "VEGETATIVE",
  "FLOWERING",
  "HARVESTED",
];

export async function nextPlantBatchNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(plantBatches)
    .where(eq(plantBatches.organizationId, ctx.orgId));
  return `PB-${String(Number(value) + 1).padStart(4, "0")}`;
}

export async function listPlantBatches(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = eq(plantBatches.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(plantBatches)
    .where(where)
    .orderBy(desc(plantBatches.plantedDate))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(plantBatches).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getPlantBatch(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(plantBatches)
    .where(and(eq(plantBatches.organizationId, ctx.orgId), eq(plantBatches.id, id)))
    .limit(1);
  return row ?? null;
}

export type PlantBatchInput = {
  id?: string;
  batchNumber?: string;
  strainId?: string | null;
  locationId?: string | null;
  count?: number;
  phase?: PlantPhase;
  sourceType?: string | null;
};

export async function upsertPlantBatch(ctx: ServiceCtx, input: PlantBatchInput) {
  if (input.id) {
    const [row] = await db
      .update(plantBatches)
      .set({
        ...(input.batchNumber != null ? { batchNumber: input.batchNumber.trim() } : {}),
        ...(input.strainId !== undefined ? { strainId: input.strainId } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
        ...(input.count != null ? { count: input.count } : {}),
        ...(input.phase != null ? { phase: input.phase } : {}),
        ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(plantBatches.organizationId, ctx.orgId), eq(plantBatches.id, input.id)))
      .returning();
    if (!row) throw new Error("Plant batch not found.");
    await recordAudit(ctx, { action: "plant_batch.update", entityType: "plant_batch", entityId: row.id, after: { count: row.count, phase: row.phase } });
    return { row, created: false };
  }
  const batchNumber = input.batchNumber?.trim() || (await nextPlantBatchNumber(ctx));
  const [row] = await db
    .insert(plantBatches)
    .values({
      organizationId: ctx.orgId,
      batchNumber,
      strainId: input.strainId ?? null,
      locationId: input.locationId ?? null,
      count: input.count ?? 0,
      phase: input.phase ?? "IMMATURE",
      sourceType: input.sourceType ?? null,
    })
    .returning();
  await recordAudit(ctx, { action: "plant_batch.create", entityType: "plant_batch", entityId: row.id, after: { batchNumber, count: row.count } });
  return { row, created: true };
}

/**
 * Advance a plant batch to the next phase in the grow lifecycle
 * (IMMATURE → VEGETATIVE → FLOWERING → HARVESTED), or to an explicit `to`
 * phase. Logs a PHASE_CHANGE (or DESTROY) event on the batch's timeline and
 * mirrors it into the audit trail. Throws if there is no next phase.
 */
export async function advancePlantBatchPhase(
  ctx: ServiceCtx,
  id: string,
  to?: PlantPhase,
) {
  const before = await getPlantBatch(ctx, id);
  if (!before) throw new Error("Plant batch not found.");
  let next: PlantPhase;
  if (to) {
    next = to;
  } else {
    const idx = PLANT_BATCH_PHASE_ORDER.indexOf(before.phase);
    if (idx < 0 || idx >= PLANT_BATCH_PHASE_ORDER.length - 1)
      throw new Error(
        `Batch ${before.batchNumber} is already ${before.phase}; there is no next phase.`,
      );
    next = PLANT_BATCH_PHASE_ORDER[idx + 1];
  }
  const [row] = await db
    .update(plantBatches)
    .set({ phase: next, updatedAt: new Date() })
    .where(and(eq(plantBatches.organizationId, ctx.orgId), eq(plantBatches.id, id)))
    .returning();
  await recordAudit(ctx, {
    action: "plant_batch.phase",
    entityType: "plant_batch",
    entityId: id,
    before: { phase: before.phase },
    after: { phase: next },
  });
  await logPlantEvent(ctx, {
    plantBatchId: id,
    type: next === "DESTROYED" ? "DESTROY" : "PHASE_CHANGE",
    note: `${before.phase} → ${next}`,
    detail: JSON.stringify({ from: before.phase, to: next }),
  });
  return row;
}

export function plantBatchToApi(r: Row) {
  return {
    id: r.id,
    batch_number: r.batchNumber,
    strain: r.strainId ? { id: r.strainId } : null,
    location: r.locationId ? { id: r.locationId } : null,
    count: String(r.count),
    phase: r.phase,
    source_type: r.sourceType ?? null,
    planted_date: datetime(r.plantedDate),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
