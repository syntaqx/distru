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
import { bins, packages, batches, products } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, num, recordAudit } from "@/lib/modules/shared";
import { and, asc, count, desc, eq, or } from "drizzle-orm";
import { issueStock, transferStock } from "./costing";

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
  batchId?: string | null;
  quantity?: string | number | null;
  status?: string;
  barcode?: string | null;
  serialNumber?: string | null;
  metrcTag?: string | null;
  labTestingState?: string | null;
  isTestSample?: boolean;
  isTradeSample?: boolean;
  isProductionBatch?: boolean;
};

export async function upsertPackage(ctx: ServiceCtx, input: PackageInput) {
  if (input.id) {
    const existing = await getPackage(ctx, input.id);
    if (!existing) throw new Error("Package not found.");
    const values: Record<string, unknown> = {};
    if (input.packageTag !== undefined) values.packageTag = input.packageTag;
    if (input.productId !== undefined) values.productId = input.productId;
    if (input.locationId !== undefined) values.locationId = input.locationId;
    if (input.batchId !== undefined) values.batchId = input.batchId;
    if (input.quantity !== undefined)
      values.quantity = input.quantity == null ? input.quantity : String(input.quantity);
    if (input.status !== undefined) values.status = input.status;
    if (input.barcode !== undefined) values.barcode = input.barcode;
    if (input.serialNumber !== undefined) values.serialNumber = input.serialNumber;
    if (input.metrcTag !== undefined) values.metrcTag = input.metrcTag;
    if (input.labTestingState !== undefined) values.labTestingState = input.labTestingState;
    if (input.isTestSample !== undefined) values.isTestSample = input.isTestSample;
    if (input.isTradeSample !== undefined) values.isTradeSample = input.isTradeSample;
    if (input.isProductionBatch !== undefined) values.isProductionBatch = input.isProductionBatch;
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
      batchId: input.batchId ?? null,
      ...(input.quantity !== undefined && input.quantity !== null
        ? { quantity: String(input.quantity) }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      barcode: input.barcode ?? null,
      serialNumber: input.serialNumber ?? null,
      metrcTag: input.metrcTag ?? null,
      labTestingState: input.labTestingState ?? null,
      ...(input.isTestSample !== undefined ? { isTestSample: input.isTestSample } : {}),
      ...(input.isTradeSample !== undefined ? { isTradeSample: input.isTradeSample } : {}),
      ...(input.isProductionBatch !== undefined
        ? { isProductionBatch: input.isProductionBatch }
        : {}),
    })
    .returning();
  return { row, created: true };
}

/**
 * Split a quantity off a source package into a new package (repackaging - the
 * product's on-hand is unchanged, the package rows re-partition). Returns both.
 */
export async function splitPackage(
  ctx: ServiceCtx,
  input: { packageId: string; quantity: number; newTag?: string },
) {
  const src = await getPackage(ctx, input.packageId);
  if (!src) throw new Error("Package not found.");
  const srcQty = Number(src.quantity ?? 0);
  if (input.quantity <= 0) throw new Error("Split quantity must be positive.");
  if (input.quantity > srcQty)
    throw new Error(`Cannot split ${input.quantity} from a package holding ${srcQty}.`);
  await db
    .update(packages)
    .set({ quantity: String(srcQty - input.quantity), updatedAt: new Date() })
    .where(and(eq(packages.organizationId, ctx.orgId), eq(packages.id, src.id)));
  const tag = input.newTag ?? `${src.packageTag}-S${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const { row: created } = await upsertPackage(ctx, {
    packageTag: tag,
    productId: src.productId,
    locationId: src.locationId,
    batchId: src.batchId,
    quantity: input.quantity,
    status: "ACTIVE",
    metrcTag: tag,
    labTestingState: src.labTestingState,
  });
  await recordAudit(ctx, {
    action: "package.split",
    entityType: "package",
    entityId: src.id,
    after: { newPackageId: created.id, quantity: input.quantity },
  });
  return { source: (await getPackage(ctx, src.id))!, created };
}

/**
 * Pull a test sample off a package: a new package flagged `is_test_sample`,
 * reducing the source. The sample leaves sellable stock (issued from the ledger).
 */
export async function createTestSample(
  ctx: ServiceCtx,
  input: { packageId: string; quantity: number; newTag?: string },
) {
  const src = await getPackage(ctx, input.packageId);
  if (!src) throw new Error("Package not found.");
  const srcQty = Number(src.quantity ?? 0);
  if (input.quantity <= 0) throw new Error("Sample quantity must be positive.");
  if (input.quantity > srcQty)
    throw new Error(`Cannot sample ${input.quantity} from a package holding ${srcQty}.`);
  // The sample is consumed out of sellable inventory.
  if (src.productId && src.locationId) {
    await issueStock(ctx, {
      productId: src.productId,
      locationId: src.locationId,
      qty: input.quantity,
      reason: `test-sample:${src.packageTag}`,
      refType: "PACKAGE",
      refId: src.id,
      allowNegative: true,
    });
  }
  await db
    .update(packages)
    .set({ quantity: String(srcQty - input.quantity), updatedAt: new Date() })
    .where(and(eq(packages.organizationId, ctx.orgId), eq(packages.id, src.id)));
  const tag = input.newTag ?? `${src.packageTag}-TS${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const { row: created } = await upsertPackage(ctx, {
    packageTag: tag,
    productId: src.productId,
    locationId: src.locationId,
    batchId: src.batchId,
    quantity: input.quantity,
    status: "ACTIVE",
    metrcTag: tag,
    isTestSample: true,
    labTestingState: "SubmittedForTesting",
  });
  await recordAudit(ctx, {
    action: "package.test_sample",
    entityType: "package",
    entityId: src.id,
    after: { newPackageId: created.id, quantity: input.quantity },
  });
  return { source: (await getPackage(ctx, src.id))!, created };
}

/**
 * Move a package to another location: transfer its quantity of the product
 * between locations (cost-preserving, blocking on shortfall) and repoint the
 * package. Real behavior for what used to be an accept-and-echo stub.
 */
export async function movePackage(ctx: ServiceCtx, id: string, toLocationId: string) {
  const pkg = await getPackage(ctx, id);
  if (!pkg) throw new Error("Package not found.");
  const qty = Number(pkg.quantity ?? 0);
  if (pkg.locationId && pkg.productId && qty > 0 && pkg.locationId !== toLocationId) {
    await transferStock(ctx, {
      productId: pkg.productId,
      fromLocationId: pkg.locationId,
      toLocationId,
      qty,
      reason: `package-move:${pkg.packageTag}`,
    });
  }
  await db
    .update(packages)
    .set({ locationId: toLocationId, updatedAt: new Date() })
    .where(and(eq(packages.organizationId, ctx.orgId), eq(packages.id, id)));
  await recordAudit(ctx, {
    action: "package.move",
    entityType: "package",
    entityId: id,
    after: { toLocationId, quantity: qty },
  });
  return (await getPackage(ctx, id))!;
}

/**
 * Finish a package: issue its remaining quantity out of inventory and mark it
 * FINISHED (Metrc's terminal package state). Real behavior for a former stub.
 */
export async function finishPackage(ctx: ServiceCtx, id: string) {
  const pkg = await getPackage(ctx, id);
  if (!pkg) throw new Error("Package not found.");
  const qty = Number(pkg.quantity ?? 0);
  if (pkg.locationId && pkg.productId && qty > 0) {
    await issueStock(ctx, {
      productId: pkg.productId,
      locationId: pkg.locationId,
      qty,
      reason: `package-finish:${pkg.packageTag}`,
      refType: "PACKAGE",
      refId: id,
      allowNegative: true,
    });
  }
  await db
    .update(packages)
    .set({ status: "FINISHED", quantity: "0", updatedAt: new Date() })
    .where(and(eq(packages.organizationId, ctx.orgId), eq(packages.id, id)));
  await recordAudit(ctx, {
    action: "package.finish",
    entityType: "package",
    entityId: id,
    after: { finishedQuantity: qty },
  });
  return (await getPackage(ctx, id))!;
}

export function packageToApi(r: PackageRow, cost?: { perUnit: number; total: number } | null) {
  const qty = Number(r.quantity ?? 0);
  return {
    id: r.id,
    package_tag: r.packageTag,
    // Distru identifies packages by their compliance label (the Metrc/BioTrack
    // tag). We surface it under Distru's field name alongside our own.
    compliance_label: r.metrcTag ?? r.packageTag,
    product_id: r.productId ?? null,
    location_id: r.locationId ?? null,
    batch_id: r.batchId ?? null,
    quantity: num(r.quantity),
    quantity_active: num(qty),
    status: r.status,
    distru_status: r.status,
    barcode: r.barcode ?? null,
    serial_number: r.serialNumber ?? null,
    metrc_tag: r.metrcTag ?? null,
    lab_testing_state: r.labTestingState ?? null,
    is_test_sample: r.isTestSample,
    is_trade_sample: r.isTradeSample,
    is_production_batch: r.isProductionBatch,
    cost_per_unit_actual: cost ? num(cost.perUnit) : null,
    total_cost_actual: cost ? num(cost.total) : null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

/**
 * Resolve a scanned code (barcode, package tag, Metrc tag, serial, or product
 * SKU/barcode) to what it identifies. Powers a warehouse scan-lookup: point a
 * scanner at a label and get the package/product plus its on-hand back.
 */
export async function scanCode(ctx: ServiceCtx, code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const [pkg] = await db
    .select()
    .from(packages)
    .where(
      and(
        eq(packages.organizationId, ctx.orgId),
        or(
          eq(packages.packageTag, trimmed),
          eq(packages.barcode, trimmed),
          eq(packages.metrcTag, trimmed),
          eq(packages.serialNumber, trimmed),
        ),
      ),
    )
    .limit(1);
  if (pkg) return { kind: "package" as const, package: pkg };
  const [prod] = await db
    .select({ id: products.id, sku: products.sku, name: products.name })
    .from(products)
    .where(
      and(
        eq(products.organizationId, ctx.orgId),
        or(eq(products.sku, trimmed), eq(products.barcode, trimmed)),
      ),
    )
    .limit(1);
  if (prod) return { kind: "product" as const, product: prod };
  return null;
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

export type BatchInput = {
  id?: string;
  batchNumber?: string;
  name?: string | null;
  productId?: string | null;
  quantity?: string | number | null;
  thc?: string | number | null;
  cbd?: string | number | null;
  manufacturedAt?: Date | null;
};

export async function upsertBatch(ctx: ServiceCtx, input: BatchInput) {
  if (input.id) {
    const existing = await getBatch(ctx, input.id);
    if (!existing) throw new Error("Batch not found.");
    const values: Record<string, unknown> = {};
    if (input.batchNumber !== undefined) values.batchNumber = input.batchNumber;
    if (input.name !== undefined) values.name = input.name;
    if (input.productId !== undefined) values.productId = input.productId;
    if (input.quantity !== undefined)
      values.quantity = input.quantity == null ? "0" : String(input.quantity);
    if (input.thc !== undefined) values.thc = input.thc == null ? null : String(input.thc);
    if (input.cbd !== undefined) values.cbd = input.cbd == null ? null : String(input.cbd);
    if (input.manufacturedAt !== undefined) values.manufacturedAt = input.manufacturedAt;
    if (Object.keys(values).length > 0) {
      values.updatedAt = new Date();
      await db
        .update(batches)
        .set(values)
        .where(and(eq(batches.organizationId, ctx.orgId), eq(batches.id, input.id)));
    }
    return { row: (await getBatch(ctx, input.id))!, created: false };
  }
  if (!input.batchNumber && !input.name)
    throw new Error("batch_number or name is required to create a batch.");
  const [row] = await db
    .insert(batches)
    .values({
      organizationId: ctx.orgId,
      batchNumber: input.batchNumber ?? input.name!,
      name: input.name ?? input.batchNumber ?? null,
      productId: input.productId ?? null,
      ...(input.quantity != null ? { quantity: String(input.quantity) } : {}),
      ...(input.thc != null ? { thc: String(input.thc) } : {}),
      ...(input.cbd != null ? { cbd: String(input.cbd) } : {}),
      manufacturedAt: input.manufacturedAt ?? null,
    })
    .returning();
  return { row, created: true };
}

export function batchToApi(r: BatchRow, cost?: { perUnit: number; total: number } | null) {
  return {
    id: r.id,
    batch_number: r.batchNumber,
    name: r.name ?? r.batchNumber,
    product_id: r.productId ?? null,
    quantity_active: num(r.quantity),
    thc: num(r.thc),
    cbd: num(r.cbd),
    cost_per_unit_actual: cost ? num(cost.perUnit) : null,
    total_cost_actual: cost ? num(cost.total) : null,
    manufactured_datetime: datetime(r.manufacturedAt),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
