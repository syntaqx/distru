import { db } from "@/db";
import { plants } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, recordAudit } from "@/lib/modules/shared";
import { and, count, desc, eq } from "drizzle-orm";
import type { PlantPhase } from "./plant-batches";
import { logPlantEvent } from "./plant-events";

type Row = typeof plants.$inferSelect;

export async function nextPlantTag(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(plants)
    .where(eq(plants.organizationId, ctx.orgId));
  return `PLT-${String(Number(value) + 1).padStart(5, "0")}`;
}

export async function listPlants(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number; phase?: PlantPhase } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = opts.phase
    ? and(eq(plants.organizationId, ctx.orgId), eq(plants.phase, opts.phase))
    : eq(plants.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(plants)
    .where(where)
    .orderBy(desc(plants.plantedDate))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(plants).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getPlant(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(plants)
    .where(and(eq(plants.organizationId, ctx.orgId), eq(plants.id, id)))
    .limit(1);
  return row ?? null;
}

export type PlantInput = {
  id?: string;
  plantTag?: string;
  strainId?: string | null;
  locationId?: string | null;
  plantBatchId?: string | null;
  phase?: PlantPhase;
};

export async function upsertPlant(ctx: ServiceCtx, input: PlantInput) {
  if (input.id) {
    const [row] = await db
      .update(plants)
      .set({
        ...(input.plantTag != null ? { plantTag: input.plantTag.trim() } : {}),
        ...(input.strainId !== undefined ? { strainId: input.strainId } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
        ...(input.plantBatchId !== undefined ? { plantBatchId: input.plantBatchId } : {}),
        ...(input.phase != null ? { phase: input.phase } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(plants.organizationId, ctx.orgId), eq(plants.id, input.id)))
      .returning();
    if (!row) throw new Error("Plant not found.");
    return { row, created: false };
  }
  const plantTag = input.plantTag?.trim() || (await nextPlantTag(ctx));
  const [row] = await db
    .insert(plants)
    .values({
      organizationId: ctx.orgId,
      plantTag,
      strainId: input.strainId ?? null,
      locationId: input.locationId ?? null,
      plantBatchId: input.plantBatchId ?? null,
      phase: input.phase ?? "VEGETATIVE",
    })
    .returning();
  await recordAudit(ctx, { action: "plant.create", entityType: "plant", entityId: row.id, after: { plantTag } });
  return { row, created: true };
}

/** Advance (or set) a plant's lifecycle phase, recording the transition. */
export async function movePlantPhase(ctx: ServiceCtx, id: string, phase: PlantPhase) {
  const before = await getPlant(ctx, id);
  if (!before) throw new Error("Plant not found.");
  const [row] = await db
    .update(plants)
    .set({ phase, updatedAt: new Date() })
    .where(and(eq(plants.organizationId, ctx.orgId), eq(plants.id, id)))
    .returning();
  await recordAudit(ctx, {
    action: "plant.phase",
    entityType: "plant",
    entityId: id,
    before: { phase: before.phase },
    after: { phase },
  });
  await logPlantEvent(ctx, {
    plantId: id,
    type: phase === "DESTROYED" ? "DESTROY" : "PHASE_CHANGE",
    note: `${before.phase} → ${phase}`,
    detail: JSON.stringify({ from: before.phase, to: phase }),
  });
  return row;
}

export function plantToApi(r: Row) {
  return {
    id: r.id,
    plant_tag: r.plantTag,
    strain: r.strainId ? { id: r.strainId } : null,
    location: r.locationId ? { id: r.locationId } : null,
    plant_batch: r.plantBatchId ? { id: r.plantBatchId } : null,
    phase: r.phase,
    planted_date: datetime(r.plantedDate),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
