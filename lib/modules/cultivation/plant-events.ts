import { db } from "@/db";
import { plantEvents } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, recordAudit } from "@/lib/modules/shared";
import { and, count, desc, eq, or } from "drizzle-orm";

type Row = typeof plantEvents.$inferSelect;

/** Lifecycle event kinds. Kept as a TS union over `text` (see schema note). */
export type PlantEventType =
  | "MOVE"
  | "FEED"
  | "PHASE_CHANGE"
  | "DESTROY"
  | "HARVEST"
  | "NOTE";

export const PLANT_EVENT_TYPES: PlantEventType[] = [
  "MOVE",
  "FEED",
  "PHASE_CHANGE",
  "DESTROY",
  "HARVEST",
  "NOTE",
];

export type PlantEventInput = {
  plantId?: string | null;
  plantBatchId?: string | null;
  type: PlantEventType;
  note?: string | null;
  detail?: string | null;
  occurredAt?: Date | null;
};

/**
 * Append a lifecycle event to a plant or plant batch and mirror it into the
 * cross-face audit trail. Returns the created row.
 */
export async function logPlantEvent(ctx: ServiceCtx, input: PlantEventInput) {
  const [row] = await db
    .insert(plantEvents)
    .values({
      organizationId: ctx.orgId,
      plantId: input.plantId ?? null,
      plantBatchId: input.plantBatchId ?? null,
      type: input.type,
      note: input.note ?? null,
      detail: input.detail ?? null,
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
    })
    .returning();
  await recordAudit(ctx, {
    action: "plant_event.log",
    entityType: input.plantId ? "plant" : "plant_batch",
    entityId: input.plantId ?? input.plantBatchId ?? null,
    after: { type: row.type, note: row.note ?? undefined },
  });
  return row;
}

/**
 * The event timeline for a plant and/or plant batch, newest first. Pass either
 * or both ids; with both, events for either subject are returned.
 */
export async function listPlantEvents(
  ctx: ServiceCtx,
  opts: {
    plantId?: string;
    plantBatchId?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const subject = [
    opts.plantId ? eq(plantEvents.plantId, opts.plantId) : undefined,
    opts.plantBatchId ? eq(plantEvents.plantBatchId, opts.plantBatchId) : undefined,
  ].filter(Boolean);
  const where =
    subject.length > 0
      ? and(eq(plantEvents.organizationId, ctx.orgId), or(...subject))
      : eq(plantEvents.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(plantEvents)
    .where(where)
    .orderBy(desc(plantEvents.occurredAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(plantEvents)
    .where(where);
  return { items, total: Number(total), limit, offset };
}

export function plantEventToApi(r: Row) {
  return {
    id: r.id,
    plant_id: r.plantId ?? null,
    plant_batch_id: r.plantBatchId ?? null,
    type: r.type,
    note: r.note ?? null,
    detail: r.detail ?? null,
    occurred_datetime: datetime(r.occurredAt),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
