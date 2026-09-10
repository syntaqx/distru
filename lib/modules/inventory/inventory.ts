import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryLedger } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit } from "../shared";
import { issueStock, receiveStock } from "./costing";

/** Current on-hand for a product (optionally at one location) = SUM(deltas). */
export async function getOnHand(
  ctx: ServiceCtx,
  productId: string,
  locationId?: string,
) {
  const filters = [
    eq(inventoryLedger.organizationId, ctx.orgId),
    eq(inventoryLedger.productId, productId),
  ];
  if (locationId) filters.push(eq(inventoryLedger.locationId, locationId));
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${inventoryLedger.quantityDelta}), 0)` })
    .from(inventoryLedger)
    .where(and(...filters));
  return Number(row?.total ?? 0);
}

/**
 * List inventory movements as adjustments (Distru's StockAdjustment list),
 * newest first, with the location name joined. Every ledger row is a movement;
 * the `reason`/`refType` say what caused it.
 */
export async function listAdjustments(
  ctx: ServiceCtx,
  { limit, offset }: { limit?: number; offset?: number } = {},
) {
  const lim = Math.min(Math.max(limit ?? 50, 1), 200);
  const off = Math.max(offset ?? 0, 0);
  const where = eq(inventoryLedger.organizationId, ctx.orgId);
  const rows = await db
    .select({
      id: inventoryLedger.id,
      productId: inventoryLedger.productId,
      locationId: inventoryLedger.locationId,
      quantityDelta: inventoryLedger.quantityDelta,
      unitCost: inventoryLedger.unitCost,
      reason: inventoryLedger.reason,
      refType: inventoryLedger.refType,
      createdAt: inventoryLedger.createdAt,
    })
    .from(inventoryLedger)
    .where(where)
    .orderBy(sql`${inventoryLedger.createdAt} desc`)
    .limit(lim)
    .offset(off);
  const [row] = await db
    .select({ total: sql<string>`count(*)` })
    .from(inventoryLedger)
    .where(where);
  return { items: rows, total: Number(row?.total ?? 0), limit: lim, offset: off };
}

/** Map of productId → total on-hand across all locations for the org. */
export async function onHandByProduct(ctx: ServiceCtx) {
  const rows = await db
    .select({
      productId: inventoryLedger.productId,
      total: sql<string>`coalesce(sum(${inventoryLedger.quantityDelta}), 0)`,
    })
    .from(inventoryLedger)
    .where(eq(inventoryLedger.organizationId, ctx.orgId))
    .groupBy(inventoryLedger.productId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.productId, Number(r.total));
  return map;
}

/**
 * Post an inventory movement. Returns the new on-hand at that location.
 *
 * Delegates to the FIFO cost engine so every caller gets lot costing for free:
 * a positive delta opens a cost layer (at the product's standard cost), a
 * negative delta draws layers down oldest-first. Adjustments may drive on-hand
 * negative (cycle-count corrections), so this path allows it; the typed
 * order/purchase/assembly paths block instead. Records `inventory.adjust` itself
 * and suppresses the primitive's own audit so the activity feed stays clean.
 */
export async function adjustInventory(
  ctx: ServiceCtx,
  input: {
    productId: string;
    locationId: string;
    delta: number;
    reason?: string;
    /** Cost layer opened on a positive adjustment; defaults to standard cost. */
    unitCost?: number;
  },
) {
  if (input.delta > 0) {
    await receiveStock(ctx, {
      productId: input.productId,
      locationId: input.locationId,
      qty: input.delta,
      unitCost: input.unitCost,
      sourceType: "ADJUSTMENT",
      reason: input.reason ?? "adjustment",
      audit: false,
    });
  } else if (input.delta < 0) {
    await issueStock(ctx, {
      productId: input.productId,
      locationId: input.locationId,
      qty: -input.delta,
      reason: input.reason ?? "adjustment",
      refType: "ADJUSTMENT",
      allowNegative: true,
      audit: false,
    });
  }
  await recordAudit(ctx, {
    action: "inventory.adjust",
    entityType: "product",
    entityId: input.productId,
    after: { delta: input.delta, locationId: input.locationId, reason: input.reason },
  });
  return { onHand: await getOnHand(ctx, input.productId, input.locationId) };
}

/** Set the on-hand at a location to an absolute target by posting the delta. */
export async function setOnHand(
  ctx: ServiceCtx,
  input: {
    productId: string;
    locationId: string;
    target: number;
    reason?: string;
  },
) {
  const current = await getOnHand(ctx, input.productId, input.locationId);
  const delta = input.target - current;
  if (delta === 0) return { onHand: current };
  return adjustInventory(ctx, {
    productId: input.productId,
    locationId: input.locationId,
    delta,
    reason: input.reason ?? "set on-hand",
  });
}

/**
 * Set on-hand to the same target for many products at one location. Posts one
 * ledger movement per product (each stays auditable) but is driven by a single
 * approval in the Copilot.
 */
export async function bulkSetOnHand(
  ctx: ServiceCtx,
  input: { productIds: string[]; locationId: string; target: number },
) {
  let updated = 0;
  for (const productId of input.productIds) {
    await setOnHand(ctx, {
      productId,
      locationId: input.locationId,
      target: input.target,
      reason: "bulk set on-hand",
    });
    updated += 1;
  }
  return { updated };
}
