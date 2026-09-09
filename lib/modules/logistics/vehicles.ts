import { db } from "@/db";
import { vehicles } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";
import { and, asc, count, eq } from "drizzle-orm";

type Row = typeof vehicles.$inferSelect;

export async function listVehicles(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = eq(vehicles.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(vehicles)
    .where(where)
    .orderBy(asc(vehicles.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(vehicles).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getVehicle(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.organizationId, ctx.orgId), eq(vehicles.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates only the fields sent; without id creates. */
export async function upsertVehicle(
  ctx: ServiceCtx,
  input: {
    id?: string;
    name?: string;
    make?: string | null;
    model?: string | null;
    licensePlate?: string | null;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(vehicles)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.make !== undefined ? { make: input.make } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.licensePlate !== undefined ? { licensePlate: input.licensePlate } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(vehicles.organizationId, ctx.orgId), eq(vehicles.id, input.id)))
      .returning();
    if (!row) throw new Error("Vehicle not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(vehicles)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      make: input.make ?? null,
      model: input.model ?? null,
      licensePlate: input.licensePlate ?? null,
    })
    .returning();
  return { row, created: true };
}

export function vehicleToApi(r: Row) {
  return {
    id: r.id,
    name: r.name,
    make: r.make ?? null,
    model: r.model ?? null,
    license_plate: r.licensePlate ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
