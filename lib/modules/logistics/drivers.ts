import { db } from "@/db";
import { drivers } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";
import { and, asc, count, eq } from "drizzle-orm";

type Row = typeof drivers.$inferSelect;

export async function listDrivers(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = eq(drivers.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(drivers)
    .where(where)
    .orderBy(asc(drivers.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(drivers).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getDriver(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates only the fields sent; without id creates. */
export async function upsertDriver(
  ctx: ServiceCtx,
  input: { id?: string; name?: string; phone?: string | null; licenseNumber?: string | null },
) {
  if (input.id) {
    const [row] = await db
      .update(drivers)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.id, input.id)))
      .returning();
    if (!row) throw new Error("Driver not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(drivers)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      phone: input.phone ?? null,
      licenseNumber: input.licenseNumber ?? null,
    })
    .returning();
  return { row, created: true };
}

export function driverToApi(r: Row) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? null,
    license_number: r.licenseNumber ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
