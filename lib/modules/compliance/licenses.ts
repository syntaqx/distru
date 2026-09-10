import { and, asc, count, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
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
    companyId?: string | null;
    name?: string | null;
    state?: string | null;
    active?: boolean;
    issuedAt?: Date | null;
    expiresAt?: Date | null;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(licenses)
      .set({
        ...(input.licenseNumber != null ? { licenseNumber: input.licenseNumber.trim() } : {}),
        ...(input.licenseTypeId !== undefined ? { licenseTypeId: input.licenseTypeId } : {}),
        ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.issuedAt !== undefined ? { issuedAt: input.issuedAt } : {}),
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
      companyId: input.companyId ?? null,
      name: input.name ?? null,
      state: input.state ?? null,
      ...(input.active !== undefined ? { active: input.active } : {}),
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  return { row, created: true };
}

/** Licenses belonging to one company. */
export async function listCompanyLicenses(ctx: ServiceCtx, companyId: string) {
  return db
    .select()
    .from(licenses)
    .where(and(eq(licenses.organizationId, ctx.orgId), eq(licenses.companyId, companyId)))
    .orderBy(desc(licenses.createdAt));
}

/**
 * Compliance check: does a company hold at least one currently-valid license?
 * A license with no expiry is treated as valid. Used to flag selling to an
 * unlicensed/expired customer.
 */
export async function validateCompanyLicense(
  ctx: ServiceCtx,
  companyId: string,
): Promise<{ ok: boolean; activeCount: number; reason: string | null }> {
  const rows = await listCompanyLicenses(ctx, companyId);
  if (rows.length === 0)
    return { ok: false, activeCount: 0, reason: "No license on file for this company." };
  const now = Date.now();
  const active = rows.filter((r) => !r.expiresAt || r.expiresAt.getTime() >= now);
  if (active.length === 0)
    return { ok: false, activeCount: 0, reason: "All licenses for this company are expired." };
  return { ok: true, activeCount: active.length, reason: null };
}

/** Licenses expiring within `days` (default 30) - drives expiry alerts. */
export async function expiringLicenses(ctx: ServiceCtx, days = 30) {
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(licenses)
    .where(
      and(
        eq(licenses.organizationId, ctx.orgId),
        isNotNull(licenses.expiresAt),
        gte(licenses.expiresAt, now),
        lte(licenses.expiresAt, horizon),
      ),
    )
    .orderBy(asc(licenses.expiresAt));
}

export function licenseToApi(row: LicenseRow, typeName?: string | null) {
  // `active` reflects both the stored flag and expiry: an expired license is
  // never active, matching Distru's boolean.
  const notExpired = !row.expiresAt || row.expiresAt.getTime() >= Date.now();
  return {
    id: row.id,
    license_number: row.licenseNumber,
    license_type_id: row.licenseTypeId ?? null,
    license_type: typeName ?? null,
    company_id: row.companyId ?? null,
    name: row.name ?? null,
    state: row.state ?? null,
    active: row.active && notExpired,
    issue_datetime: datetime(row.issuedAt),
    expiry_datetime: datetime(row.expiresAt),
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}
