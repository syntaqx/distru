/**
 * FIFO cost layers - the transactional heart of inventory.
 *
 * On-hand quantity is still `SUM(inventory_ledger.quantityDelta)`, but every
 * receipt now also opens a **cost layer** (`inventory_lots`) at a known unit
 * cost, and every issue draws those layers down oldest-first (FIFO). So an issue
 * inherits a real per-unit cost (true COGS), valuation is
 * `SUM(remainingQty * unitCost)`, and stock stays fully auditable and lot-traced.
 *
 * `receiveStock` / `issueStock` / `transferStock` are the primitives; the
 * higher-level `adjustInventory` (in ./inventory) delegates to them so every
 * existing caller - orders, purchasing, returns, adjustments, imports, the
 * Copilot - gets FIFO costing for free.
 *
 * Depends on: shared.
 */
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db";
import { inventoryLedger, inventoryLots, products } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit } from "../shared";
import { getOnHand } from "./inventory";

/** Thrown when an issue/transfer would take more than is on-hand (block mode). */
export class InsufficientStockError extends Error {
  constructor(
    readonly productId: string,
    readonly needed: number,
    readonly available: number,
    readonly locationId?: string,
  ) {
    super(
      `Insufficient stock for product ${productId}: need ${needed}, have ${available}.`,
    );
    this.name = "InsufficientStockError";
  }
}

/** What created a lot - traces a cost layer back to its origin document. */
export type LotSource =
  | "PURCHASE"
  | "ASSEMBLY"
  | "ADJUSTMENT"
  | "RETURN"
  | "TRANSFER"
  | "OPENING"
  | "IMPORT";

function newLotNumber(): string {
  // Use the random tail of a uuidv7 (the leading hex is a millisecond timestamp
  // that collides when two lots are created in the same tick).
  return "LOT-" + uuidv7().replace(/-/g, "").slice(-12).toUpperCase();
}

/** Product's standard unit cost, used as the fallback COGS basis. */
async function standardCost(orgId: string, productId: string): Promise<number> {
  const [row] = await db
    .select({ unitCost: products.unitCost })
    .from(products)
    .where(and(eq(products.organizationId, orgId), eq(products.id, productId)))
    .limit(1);
  return Number(row?.unitCost ?? 0);
}

export type ReceiveInput = {
  productId: string;
  locationId: string;
  qty: number;
  /** Per-unit cost of this receipt. Falls back to the product's standard cost. */
  unitCost?: number;
  sourceType?: LotSource;
  sourceId?: string | null;
  binId?: string | null;
  packageId?: string | null;
  reason?: string;
  expiresAt?: Date | null;
  /** Record an audit entry for this receipt (default true). */
  audit?: boolean;
};

/**
 * Receive stock: open a FIFO cost layer and post a matching positive ledger
 * movement. Returns the new lot id and on-hand at the location.
 */
export async function receiveStock(
  ctx: ServiceCtx,
  input: ReceiveInput,
): Promise<{ lotId: string; lotNumber: string; onHand: number }> {
  if (input.qty <= 0) throw new Error("receiveStock qty must be positive.");
  const unitCost =
    input.unitCost ?? (await standardCost(ctx.orgId, input.productId));
  const lotNumber = newLotNumber();
  const sourceType = input.sourceType ?? "ADJUSTMENT";

  const lotId = await db.transaction(async (tx) => {
    const [lot] = await tx
      .insert(inventoryLots)
      .values({
        organizationId: ctx.orgId,
        productId: input.productId,
        locationId: input.locationId,
        binId: input.binId ?? null,
        packageId: input.packageId ?? null,
        lotNumber,
        sourceType,
        sourceId: input.sourceId ?? null,
        unitCost: String(unitCost),
        originalQty: String(input.qty),
        remainingQty: String(input.qty),
        expiresAt: input.expiresAt ?? null,
      })
      .returning({ id: inventoryLots.id });
    await tx.insert(inventoryLedger).values({
      organizationId: ctx.orgId,
      productId: input.productId,
      locationId: input.locationId,
      quantityDelta: String(input.qty),
      unitCost: String(unitCost),
      lotId: lot.id,
      binId: input.binId ?? null,
      refType: sourceType,
      refId: input.sourceId ?? null,
      reason: input.reason ?? "receipt",
      actor: ctx.actor,
    });
    return lot.id;
  });

  if (input.audit !== false) {
    await recordAudit(ctx, {
      action: "inventory.receive",
      entityType: "product",
      entityId: input.productId,
      after: {
        qty: input.qty,
        unitCost,
        locationId: input.locationId,
        lotNumber,
        sourceType,
      },
    });
  }
  return {
    lotId,
    lotNumber,
    onHand: await getOnHand(ctx, input.productId, input.locationId),
  };
}

export type IssueInput = {
  productId: string;
  locationId: string;
  qty: number;
  reason?: string;
  refType?: string;
  refId?: string | null;
  /** Allow on-hand to go negative (corrections/cycle counts); default false. */
  allowNegative?: boolean;
  /** Record an audit entry for this issue (default true). */
  audit?: boolean;
};

export type IssueAllocation = {
  lotId: string | null;
  qty: number;
  unitCost: number;
};

/**
 * Issue stock: draw down FIFO cost layers oldest-first, posting one negative
 * ledger movement per layer at that layer's unit cost. Returns real COGS and
 * the per-lot allocation. Throws `InsufficientStockError` unless `allowNegative`.
 */
export async function issueStock(
  ctx: ServiceCtx,
  input: IssueInput,
): Promise<{ cogs: number; onHand: number; allocations: IssueAllocation[] }> {
  if (input.qty <= 0) throw new Error("issueStock qty must be positive.");
  const available = await getOnHand(ctx, input.productId, input.locationId);
  if (input.qty > available && !input.allowNegative) {
    throw new InsufficientStockError(
      input.productId,
      input.qty,
      available,
      input.locationId,
    );
  }

  const result = await db.transaction(async (tx) => {
    const lots = await tx
      .select({
        id: inventoryLots.id,
        unitCost: inventoryLots.unitCost,
        remainingQty: inventoryLots.remainingQty,
      })
      .from(inventoryLots)
      .where(
        and(
          eq(inventoryLots.organizationId, ctx.orgId),
          eq(inventoryLots.productId, input.productId),
          eq(inventoryLots.locationId, input.locationId),
          gt(inventoryLots.remainingQty, "0"),
        ),
      )
      .orderBy(asc(inventoryLots.receivedAt), asc(inventoryLots.id))
      .for("update");

    const allocations: IssueAllocation[] = [];
    let remaining = input.qty;
    let cogs = 0;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const lotRemaining = Number(lot.remainingQty);
      if (lotRemaining <= 0) continue;
      const take = Math.min(lotRemaining, remaining);
      const unitCost = Number(lot.unitCost);
      await tx
        .update(inventoryLots)
        .set({ remainingQty: String(lotRemaining - take) })
        .where(eq(inventoryLots.id, lot.id));
      await tx.insert(inventoryLedger).values({
        organizationId: ctx.orgId,
        productId: input.productId,
        locationId: input.locationId,
        quantityDelta: String(-take),
        unitCost: String(unitCost),
        lotId: lot.id,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        reason: input.reason ?? "issue",
        actor: ctx.actor,
      });
      allocations.push({ lotId: lot.id, qty: take, unitCost });
      cogs += take * unitCost;
      remaining -= take;
    }

    // Remainder with no cost layer (pre-lot stock, or a negative-going
    // correction): post one uncosted movement at the product's standard cost.
    if (remaining > 0) {
      const unitCost = await standardCost(ctx.orgId, input.productId);
      await tx.insert(inventoryLedger).values({
        organizationId: ctx.orgId,
        productId: input.productId,
        locationId: input.locationId,
        quantityDelta: String(-remaining),
        unitCost: String(unitCost),
        lotId: null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        reason: input.reason ?? "issue",
        actor: ctx.actor,
      });
      allocations.push({ lotId: null, qty: remaining, unitCost });
      cogs += remaining * unitCost;
    }

    return { cogs, allocations };
  });

  if (input.audit !== false) {
    await recordAudit(ctx, {
      action: "inventory.issue",
      entityType: "product",
      entityId: input.productId,
      after: {
        qty: input.qty,
        cogs: result.cogs,
        locationId: input.locationId,
        reason: input.reason,
      },
    });
  }
  return {
    ...result,
    onHand: await getOnHand(ctx, input.productId, input.locationId),
  };
}

export type TransferInput = {
  productId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
  binId?: string | null;
  reason?: string;
  refType?: string;
  refId?: string | null;
};

/**
 * Move stock between locations, preserving per-lot cost: FIFO-issue from the
 * source, then re-receive each drawn allocation into the destination at the same
 * unit cost. One audit-linked pair of movements per lot. Blocks on shortfall.
 */
export async function transferStock(
  ctx: ServiceCtx,
  input: TransferInput,
): Promise<{ onHand: { from: number; to: number }; movedCost: number }> {
  if (input.qty <= 0) throw new Error("transferStock qty must be positive.");
  const issued = await issueStock(ctx, {
    productId: input.productId,
    locationId: input.fromLocationId,
    qty: input.qty,
    reason: input.reason ?? "transfer out",
    refType: input.refType ?? "TRANSFER",
    refId: input.refId ?? null,
  });
  let movedCost = 0;
  for (const alloc of issued.allocations) {
    movedCost += alloc.qty * alloc.unitCost;
    await receiveStock(ctx, {
      productId: input.productId,
      locationId: input.toLocationId,
      qty: alloc.qty,
      unitCost: alloc.unitCost,
      binId: input.binId ?? null,
      sourceType: "TRANSFER",
      sourceId: input.refId ?? null,
      reason: input.reason ?? "transfer in",
    });
  }
  return {
    onHand: {
      from: issued.onHand,
      to: await getOnHand(ctx, input.productId, input.toLocationId),
    },
    movedCost,
  };
}

/**
 * Allocate an additional landed cost across a product's open FIFO lots, raising
 * their unit cost weighted by remaining quantity. This is how a post-receipt
 * cost (freight, testing, packaging) flows into COGS - Distru's `add-costs`.
 * Returns how many lots were re-costed and the per-unit bump applied.
 */
export async function addProductCosts(
  ctx: ServiceCtx,
  productId: string,
  totalCost: number,
): Promise<{ lotsUpdated: number; perUnit: number }> {
  if (totalCost === 0) return { lotsUpdated: 0, perUnit: 0 };
  const lots = await db
    .select({
      id: inventoryLots.id,
      unitCost: inventoryLots.unitCost,
      remainingQty: inventoryLots.remainingQty,
    })
    .from(inventoryLots)
    .where(
      and(
        eq(inventoryLots.organizationId, ctx.orgId),
        eq(inventoryLots.productId, productId),
        gt(inventoryLots.remainingQty, "0"),
      ),
    );
  const totalRemaining = lots.reduce((s, l) => s + Number(l.remainingQty), 0);
  if (totalRemaining <= 0) return { lotsUpdated: 0, perUnit: 0 };
  const perUnit = totalCost / totalRemaining;
  for (const lot of lots) {
    await db
      .update(inventoryLots)
      .set({ unitCost: String(Number(lot.unitCost) + perUnit) })
      .where(eq(inventoryLots.id, lot.id));
  }
  await recordAudit(ctx, {
    action: "inventory.add_costs",
    entityType: "product",
    entityId: productId,
    after: { totalCost, perUnit, lots: lots.length },
  });
  return { lotsUpdated: lots.length, perUnit };
}

export type LotRow = typeof inventoryLots.$inferSelect;

/**
 * List cost layers (FIFO lots) newest-first, optionally filtered to one product
 * or location. `openOnly` (default true) hides fully-drawn-down layers.
 */
export async function listLots(
  ctx: ServiceCtx,
  opts: {
    productId?: string;
    locationId?: string;
    openOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ items: LotRow[]; total: number; limit: number; offset: number }> {
  const lim = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const off = Math.max(opts.offset ?? 0, 0);
  const filters = [eq(inventoryLots.organizationId, ctx.orgId)];
  if (opts.productId) filters.push(eq(inventoryLots.productId, opts.productId));
  if (opts.locationId) filters.push(eq(inventoryLots.locationId, opts.locationId));
  if (opts.openOnly !== false) filters.push(gt(inventoryLots.remainingQty, "0"));
  const where = and(...filters);
  const items = await db
    .select()
    .from(inventoryLots)
    .where(where)
    .orderBy(sql`${inventoryLots.receivedAt} desc`)
    .limit(lim)
    .offset(off);
  const [row] = await db.select({ total: sql<string>`count(*)` }).from(inventoryLots).where(where);
  return { items, total: Number(row?.total ?? 0), limit: lim, offset: off };
}

/** Distru-flavored serializer for a cost layer. */
export function lotToApi(r: LotRow) {
  return {
    id: r.id,
    lot_number: r.lotNumber,
    product_id: r.productId,
    location_id: r.locationId,
    package_id: r.packageId ?? null,
    source_type: r.sourceType,
    source_id: r.sourceId ?? null,
    unit_cost: String(r.unitCost),
    original_quantity: String(r.originalQty),
    remaining_quantity: String(r.remainingQty),
    received_datetime: r.receivedAt.toISOString(),
    expiration_datetime: r.expiresAt ? r.expiresAt.toISOString() : null,
  };
}

/** Inventory valuation at cost = SUM(remainingQty * unitCost) over open lots. */
export async function inventoryValueByProduct(
  ctx: ServiceCtx,
): Promise<Map<string, { qty: number; value: number }>> {
  const rows = await db
    .select({
      productId: inventoryLots.productId,
      qty: sql<string>`coalesce(sum(${inventoryLots.remainingQty}), 0)`,
      value: sql<string>`coalesce(sum(${inventoryLots.remainingQty} * ${inventoryLots.unitCost}), 0)`,
    })
    .from(inventoryLots)
    .where(eq(inventoryLots.organizationId, ctx.orgId))
    .groupBy(inventoryLots.productId);
  const map = new Map<string, { qty: number; value: number }>();
  for (const r of rows) map.set(r.productId, { qty: Number(r.qty), value: Number(r.value) });
  return map;
}
