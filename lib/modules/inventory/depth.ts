/**
 * Inventory-depth resources: the finer-grained stock positions that sit beneath
 * the aggregate on-hand ledger.
 *
 *  - bins:     storage positions (shelves/slots) within a location
 *  - packages: Metrc-tracked, tagged physical units of a product
 *  - batches:  production/harvest lots that packages derive from
 *
 * Each exposes a paginated list, a by-id fetch, a sparse upsert (omit id to
 * create, include id to update only the changed fields), and a Distru-faithful
 * API serializer. All are org-scoped via ctx.orgId.
 *
 * Depends on: shared.
 */
import { db } from "@/db";
import { bins, packages, batches } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, num } from "@/lib/modules/shared";
import { and, asc, count, desc, eq } from "drizzle-orm";

export type BinRow = typeof bins.$inferSelect;
export type PackageRow = typeof packages.$inferSelect;
export type BatchRow = typeof batches.$inferSelect;

export type ListArgs = { limit?: number; offset?: number };

function clampLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? 50, 1), 200);
}

function clampOffset(offset?: number): number {
  return Math.max(offset ?? 0, 0);
}

// ---------------- Bins ----------------

export async function listBins(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(bins.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(bins)
    .where(where)
    .orderBy(asc(bins.name))
    .limit(lim)
    .offset(off);
  const [{ total }] = await db.select({ total: count() }).from(bins).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getBin(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(bins)
    .where(and(eq(bins.organizationId, ctx.orgId), eq(bins.id, id)))
    .limit(1);
  return row ?? null;
}

export type BinInput = { id?: string; name?: string; locationId?: string | null };

export async function upsertBin(ctx: ServiceCtx, input: BinInput) {
  if (input.id) {
    const existing = await getBin(ctx, input.id);
    if (!existing) throw new Error("Bin not found.");
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.locationId !== undefined) values.locationId = input.locationId;
    if (Object.keys(values).length > 0) {
      values.updatedAt = new Date();
      await db
        .update(bins)
        .set(values)
        .where(and(eq(bins.organizationId, ctx.orgId), eq(bins.id, input.id)));
    }
    return { row: (await getBin(ctx, input.id))!, created: false };
  }
  if (!input.name) throw new Error("name is required to create a bin.");
  const [row] = await db
    .insert(bins)
    .values({
      organizationId: ctx.orgId,
      name: input.name,
      locationId: input.locationId ?? null,
    })
    .returning();
  return { row, created: true };
}

export function binToApi(r: BinRow) {
  return {
    id: r.id,
    name: r.name,
    location_id: r.locationId ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Packages ----------------

export async function listPackages(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(packages.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(packages)
    .where(where)
    .orderBy(desc(packages.createdAt))
    .limit(lim)
    .offset(off);
  const [{ total }] = await db.select({ total: count() }).from(packages).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getPackage(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(packages)
    .where(and(eq(packages.organizationId, ctx.orgId), eq(packages.id, id)))
    .limit(1);
  return row ?? null;
}

export type PackageInput = {
  id?: string;
  packageTag?: string;
  productId?: string | null;
  locationId?: string | null;
  quantity?: string | number | null;
  status?: string;
};

export async function upsertPackage(ctx: ServiceCtx, input: PackageInput) {
  if (input.id) {
    const existing = await getPackage(ctx, input.id);
    if (!existing) throw new Error("Package not found.");
    const values: Record<string, unknown> = {};
    if (input.packageTag !== undefined) values.packageTag = input.packageTag;
    if (input.productId !== undefined) values.productId = input.productId;
    if (input.locationId !== undefined) values.locationId = input.locationId;
    if (input.quantity !== undefined)
      values.quantity = input.quantity == null ? input.quantity : String(input.quantity);
    if (input.status !== undefined) values.status = input.status;
    if (Object.keys(values).length > 0) {
      values.updatedAt = new Date();
      await db
        .update(packages)
        .set(values)
        .where(and(eq(packages.organizationId, ctx.orgId), eq(packages.id, input.id)));
    }
    return { row: (await getPackage(ctx, input.id))!, created: false };
  }
  if (!input.packageTag) throw new Error("package_tag is required to create a package.");
  const [row] = await db
    .insert(packages)
    .values({
      organizationId: ctx.orgId,
      packageTag: input.packageTag,
      productId: input.productId ?? null,
      locationId: input.locationId ?? null,
      ...(input.quantity !== undefined && input.quantity !== null
        ? { quantity: String(input.quantity) }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .returning();
  return { row, created: true };
}

export function packageToApi(r: PackageRow) {
  return {
    id: r.id,
    package_tag: r.packageTag,
    product_id: r.productId ?? null,
    location_id: r.locationId ?? null,
    quantity: num(r.quantity),
    status: r.status,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Batches ----------------

export async function listBatches(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(batches.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(batches)
    .where(where)
    .orderBy(desc(batches.createdAt))
    .limit(lim)
    .offset(off);
  const [{ total }] = await db.select({ total: count() }).from(batches).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getBatch(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.organizationId, ctx.orgId), eq(batches.id, id)))
    .limit(1);
  return row ?? null;
}

export type BatchInput = { id?: string; batchNumber?: string; productId?: string | null };

export async function upsertBatch(ctx: ServiceCtx, input: BatchInput) {
  if (input.id) {
    const existing = await getBatch(ctx, input.id);
    if (!existing) throw new Error("Batch not found.");
    const values: Record<string, unknown> = {};
    if (input.batchNumber !== undefined) values.batchNumber = input.batchNumber;
    if (input.productId !== undefined) values.productId = input.productId;
    if (Object.keys(values).length > 0) {
      values.updatedAt = new Date();
      await db
        .update(batches)
        .set(values)
        .where(and(eq(batches.organizationId, ctx.orgId), eq(batches.id, input.id)));
    }
    return { row: (await getBatch(ctx, input.id))!, created: false };
  }
  if (!input.batchNumber) throw new Error("batch_number is required to create a batch.");
  const [row] = await db
    .insert(batches)
    .values({
      organizationId: ctx.orgId,
      batchNumber: input.batchNumber,
      productId: input.productId ?? null,
    })
    .returning();
  return { row, created: true };
}

export function batchToApi(r: BatchRow) {
  return {
    id: r.id,
    batch_number: r.batchNumber,
    product_id: r.productId ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
