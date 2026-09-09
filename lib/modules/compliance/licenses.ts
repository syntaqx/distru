import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licenses, licenseTypes } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";

// ---------------- License types ----------------

export type LicenseTypeRow = typeof licenseTypes.$inferSelect;

export async function listLicenseTypes(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = eq(licenseTypes.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(licenseTypes)
    .where(where)
    .orderBy(asc(licenseTypes.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(licenseTypes)
    .where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getLicenseType(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(licenseTypes)
    .where(and(eq(licenseTypes.organizationId, ctx.orgId), eq(licenseTypes.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates only changed fields; without id creates. */
export async function upsertLicenseType(
  ctx: ServiceCtx,
  input: { id?: string; name?: string },
) {
  if (input.id) {
    const [row] = await db
      .update(licenseTypes)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(licenseTypes.organizationId, ctx.orgId), eq(licenseTypes.id, input.id)))
      .returning();
    if (!row) throw new Error("License type not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required to create a license type.");
  const [row] = await db
    .insert(licenseTypes)
    .values({ organizationId: ctx.orgId, name: input.name.trim() })
    .returning();
  return { row, created: true };
}

export function licenseTypeToApi(row: LicenseTypeRow) {
  return {
    id: row.id,
    name: row.name,
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}

// ---------------- Licenses ----------------

export type LicenseRow = typeof licenses.$inferSelect;

export async function listLicenses(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = eq(licenses.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(licenses)
    .where(where)
    .orderBy(desc(licenses.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(licenses)
    .where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getLicense(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(licenses)
    .where(and(eq(licenses.organizationId, ctx.orgId), eq(licenses.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates only changed fields; without id creates. */
export async function upsertLicense(
  ctx: ServiceCtx,
  input: {
    id?: string;
    licenseNumber?: string;
    licenseTypeId?: string | null;
    name?: string | null;
    state?: string | null;
    expiresAt?: Date | null;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(licenses)
      .set({
        ...(input.licenseNumber != null ? { licenseNumber: input.licenseNumber.trim() } : {}),
        ...(input.licenseTypeId !== undefined ? { licenseTypeId: input.licenseTypeId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(licenses.organizationId, ctx.orgId), eq(licenses.id, input.id)))
      .returning();
    if (!row) throw new Error("License not found.");
    return { row, created: false };
  }
  if (!input.licenseNumber) throw new Error("license_number is required to create a license.");
  const [row] = await db
    .insert(licenses)
    .values({
      organizationId: ctx.orgId,
      licenseNumber: input.licenseNumber.trim(),
      licenseTypeId: input.licenseTypeId ?? null,
      name: input.name ?? null,
      state: input.state ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return { row, created: true };
}

export function licenseToApi(row: LicenseRow) {
  return {
    id: row.id,
    license_number: row.licenseNumber,
    license_type_id: row.licenseTypeId ?? null,
    name: row.name ?? null,
    state: row.state ?? null,
    expires_datetime: datetime(row.expiresAt),
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}
