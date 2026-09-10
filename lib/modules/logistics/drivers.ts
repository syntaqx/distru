import { db } from "@/db";
import { drivers, member } from "@/db/schema";
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

/**
 * Drivers joined to the person (org member) behind each one, for the dispatch
 * directory: clicking a driver should open their person page, so we surface the
 * `memberId` when the driver is linked to a login. Distinct from `listDrivers`,
 * which stays a plain drivers query so the public delivery API is unaffected.
 */
export async function listDriverDirectory(ctx: ServiceCtx) {
  return db
    .select({
      id: drivers.id,
      name: drivers.name,
      phone: drivers.phone,
      licenseNumber: drivers.licenseNumber,
      userId: drivers.userId,
      memberId: member.id,
    })
    .from(drivers)
    .leftJoin(
      member,
      and(eq(member.userId, drivers.userId), eq(member.organizationId, ctx.orgId)),
    )
    .where(eq(drivers.organizationId, ctx.orgId))
    .orderBy(asc(drivers.name));
}

/** The driver profile linked to a given user in this org, if any. */
export async function getDriverByUser(ctx: ServiceCtx, userId: string) {
  const [row] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.userId, userId)))
    .limit(1);
  return row ?? null;
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
  input: {
    id?: string;
    name?: string;
    phone?: string | null;
    licenseNumber?: string | null;
    userId?: string | null;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(drivers)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber } : {}),
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
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
      userId: input.userId ?? null,
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
