import { db } from "@/db";
import { harvests } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, num, recordAudit } from "@/lib/modules/shared";
// Read-only use of the inventory module's public surface to close the
// seed-to-sale loop (harvest -> packaged, costed stock). We call these; we do
// not modify inventory.
import { receiveStock, upsertPackage } from "@/lib/modules/inventory";
import { and, count, desc, eq } from "drizzle-orm";

type Row = typeof harvests.$inferSelect;
export type HarvestStatus = "ACTIVE" | "FINISHED";

export async function nextHarvestNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(harvests)
    .where(eq(harvests.organizationId, ctx.orgId));
  return `H-${String(Number(value) + 1).padStart(4, "0")}`;
}

export async function listHarvests(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = eq(harvests.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(harvests)
    .where(where)
    .orderBy(desc(harvests.harvestedDate))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(harvests).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getHarvest(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(harvests)
    .where(and(eq(harvests.organizationId, ctx.orgId), eq(harvests.id, id)))
    .limit(1);
  return row ?? null;
}

export type HarvestInput = {
  id?: string;
  harvestNumber?: string;
  name?: string | null;
  strainId?: string | null;
  locationId?: string | null;
  plantCount?: number;
  wetWeight?: string | number | null;
  dryWeight?: string | number | null;
  status?: HarvestStatus;
};

const dec = (v: string | number | null | undefined) =>
  v === null || v === undefined ? v : String(v);

export async function upsertHarvest(ctx: ServiceCtx, input: HarvestInput) {
  if (input.id) {
    const [row] = await db
      .update(harvests)
      .set({
        ...(input.harvestNumber != null ? { harvestNumber: input.harvestNumber.trim() } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.strainId !== undefined ? { strainId: input.strainId } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
        ...(input.plantCount != null ? { plantCount: input.plantCount } : {}),
        ...(input.wetWeight !== undefined ? { wetWeight: dec(input.wetWeight) } : {}),
        ...(input.dryWeight !== undefined ? { dryWeight: dec(input.dryWeight) } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(harvests.organizationId, ctx.orgId), eq(harvests.id, input.id)))
      .returning();
    if (!row) throw new Error("Harvest not found.");
    await recordAudit(ctx, { action: "harvest.update", entityType: "harvest", entityId: row.id, after: { status: row.status } });
    return { row, created: false };
  }
  const harvestNumber = input.harvestNumber?.trim() || (await nextHarvestNumber(ctx));
  const [row] = await db
    .insert(harvests)
    .values({
      organizationId: ctx.orgId,
      harvestNumber,
      name: input.name ?? null,
      strainId: input.strainId ?? null,
      locationId: input.locationId ?? null,
      plantCount: input.plantCount ?? 0,
      wetWeight: dec(input.wetWeight) ?? null,
      dryWeight: dec(input.dryWeight) ?? null,
      status: input.status ?? "ACTIVE",
    })
    .returning();
  await recordAudit(ctx, { action: "harvest.create", entityType: "harvest", entityId: row.id, after: { harvestNumber } });
  return { row, created: true };
}

export type PackageHarvestInput = {
  harvestId: string;
  /** Target product the packaged flower is received as (required to cost it). */
  productId: string;
  /** Location the new package/lot lands in. */
  locationId: string;
  /** Quantity to package; defaults to the harvest's recorded dry weight. */
  quantity?: number;
  packageTag?: string;
  metrcTag?: string | null;
  /** Per-unit cost for the opened FIFO lot; defaults to product standard cost. */
  unitCost?: number;
};

/**
 * Close the seed-to-sale loop: turn a harvest's dry weight into real inventory.
 * Creates a package tied to the target product/location, posts a costed stock
 * receipt (a FIFO lot) against that package via the inventory module, and marks
 * the harvest FINISHED. Idempotent-guarded: a harvest can only be packaged once.
 */
export async function packageHarvest(ctx: ServiceCtx, input: PackageHarvestInput) {
  const harvest = await getHarvest(ctx, input.harvestId);
  if (!harvest) throw new Error("Harvest not found.");
  if (harvest.status === "FINISHED")
    throw new Error(`Harvest ${harvest.harvestNumber} is already finished/packaged.`);
  const qty =
    input.quantity ?? (harvest.dryWeight != null ? Number(harvest.dryWeight) : 0);
  if (!(qty > 0))
    throw new Error(
      "Nothing to package: set a positive quantity or record the harvest's dry weight first.",
    );

  const packageTag = input.packageTag?.trim() || `PKG-${harvest.harvestNumber}`;
  const { row: pkg } = await upsertPackage(ctx, {
    packageTag,
    productId: input.productId,
    locationId: input.locationId,
    quantity: qty,
    status: "ACTIVE",
    metrcTag: input.metrcTag ?? null,
  });

  const { lotNumber, onHand } = await receiveStock(ctx, {
    productId: input.productId,
    locationId: input.locationId,
    qty,
    unitCost: input.unitCost,
    sourceType: "OPENING",
    sourceId: harvest.id,
    packageId: pkg.id,
    reason: `Packaged from harvest ${harvest.harvestNumber}`,
  });

  const [row] = await db
    .update(harvests)
    .set({ status: "FINISHED", updatedAt: new Date() })
    .where(and(eq(harvests.organizationId, ctx.orgId), eq(harvests.id, harvest.id)))
    .returning();

  await recordAudit(ctx, {
    action: "harvest.package",
    entityType: "harvest",
    entityId: harvest.id,
    after: { packageTag, productId: input.productId, quantity: qty, lotNumber },
  });

  return { harvest: row, package: pkg, lotNumber, onHand, quantity: qty };
}

export function harvestToApi(r: Row) {
  return {
    id: r.id,
    harvest_number: r.harvestNumber,
    name: r.name ?? null,
    strain: r.strainId ? { id: r.strainId } : null,
    location: r.locationId ? { id: r.locationId } : null,
    plant_count: String(r.plantCount),
    wet_weight: num(r.wetWeight),
    dry_weight: num(r.dryWeight),
    status: r.status,
    harvested_date: datetime(r.harvestedDate),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
