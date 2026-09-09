import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, locations, purchaseOrderItems, purchaseOrders } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { recordAudit, datetime, num, ref, assertPositiveQuantities } from "@/lib/modules/shared";
import { adjustInventory } from "@/lib/modules/inventory";
import { getDefaultLocation } from "@/lib/modules/catalog";

export type PurchaseOrderStatus = "DRAFT" | "OPEN" | "RECEIVED" | "CANCELED";
export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItemRow = typeof purchaseOrderItems.$inferSelect;

export type PurchaseOrderItemInput = {
  productId?: string | null;
  sku?: string | null;
  name: string;
  quantity: number | string;
  unitCost?: number | string | null;
};

export type PurchaseOrderInput = {
  poNumber?: string;
  vendorId?: string | null;
  locationId?: string | null;
  status?: PurchaseOrderStatus;
  orderDate?: Date;
  notes?: string | null;
  items: PurchaseOrderItemInput[];
};

export type PurchaseOrderWithItems = {
  purchaseOrder: PurchaseOrderRow;
  vendor: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  items: PurchaseOrderItemRow[];
  total: number;
};

/** A received PO has posted its stock increment; draft/open/cancelled has not. */
function stockPosted(status: PurchaseOrderStatus) {
  return status === "RECEIVED";
}

function lineTotal(item: { quantity: string | number; unitCost: string | number }) {
  return Number(item.quantity) * Number(item.unitCost);
}

export function purchaseOrderTotal(items: { quantity: string | number; unitCost: string | number }[]) {
  return items.reduce((sum, i) => sum + lineTotal(i), 0);
}

/** Next per-org PO number, e.g. PO-0001. */
export async function nextPoNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.organizationId, ctx.orgId));
  return `PO-${String(Number(value) + 1).padStart(4, "0")}`;
}

/** Post (receive, +1) or reverse (-1) stock for every line at the PO's location. */
async function moveStock(
  ctx: ServiceCtx,
  po: PurchaseOrderRow,
  items: PurchaseOrderItemRow[],
  direction: -1 | 1,
) {
  const locationId = po.locationId ?? (await getDefaultLocation(ctx)).id;
  for (const item of items) {
    if (!item.productId) continue;
    const qty = Number(item.quantity) * direction;
    if (qty === 0) continue;
    await adjustInventory(ctx, {
      productId: item.productId,
      locationId,
      delta: qty,
      reason: `purchase:${po.poNumber}`,
    });
  }
}

export async function createPurchaseOrder(ctx: ServiceCtx, input: PurchaseOrderInput) {
  if (!input.items || input.items.length === 0)
    throw new Error("A purchase order needs at least one line item.");
  assertPositiveQuantities(input.items);
  const status = input.status ?? "OPEN";
  const poNumber = input.poNumber ?? (await nextPoNumber(ctx));

  const [po] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: ctx.orgId,
      poNumber,
      vendorId: input.vendorId ?? null,
      locationId: input.locationId ?? null,
      status,
      orderDate: input.orderDate ?? new Date(),
      notes: input.notes ?? null,
    })
    .returning();

  const items = await db
    .insert(purchaseOrderItems)
    .values(
      input.items.map((i) => ({
        organizationId: ctx.orgId,
        purchaseOrderId: po.id,
        productId: i.productId ?? null,
        sku: i.sku ?? null,
        name: i.name,
        quantity: String(i.quantity),
        unitCost: String(i.unitCost ?? 0),
      })),
    )
    .returning();

  if (stockPosted(status)) await moveStock(ctx, po, items, 1);

  await recordAudit(ctx, {
    action: "purchase_order.create",
    entityType: "purchase_order",
    entityId: po.id,
    after: { poNumber, status, lines: items.length, total: purchaseOrderTotal(items) },
  });
  return (await getPurchaseOrder(ctx, po.id))!;
}

export async function getPurchaseOrder(
  ctx: ServiceCtx,
  id: string,
): Promise<PurchaseOrderWithItems | null> {
  const [row] = await db
    .select({
      purchaseOrder: purchaseOrders,
      vendor: { id: companies.id, name: companies.name },
      location: { id: locations.id, name: locations.name },
    })
    .from(purchaseOrders)
    .leftJoin(companies, eq(purchaseOrders.vendorId, companies.id))
    .leftJoin(locations, eq(purchaseOrders.locationId, locations.id))
    .where(and(eq(purchaseOrders.organizationId, ctx.orgId), eq(purchaseOrders.id, id)))
    .limit(1);
  if (!row) return null;
  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderItems.createdAt));
  return {
    purchaseOrder: row.purchaseOrder,
    vendor: row.vendor?.id ? { id: row.vendor.id, name: row.vendor.name ?? "" } : null,
    location: row.location?.id ? { id: row.location.id, name: row.location.name ?? "" } : null,
    items,
    total: purchaseOrderTotal(items),
  };
}

export async function getPurchaseOrderByNumber(ctx: ServiceCtx, poNumber: string) {
  const [row] = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.organizationId, ctx.orgId), eq(purchaseOrders.poNumber, poNumber)))
    .limit(1);
  return row ? getPurchaseOrder(ctx, row.id) : null;
}

export type ListPurchaseOrdersArgs = {
  status?: PurchaseOrderStatus;
  vendorId?: string;
  search?: string;
  updatedFrom?: Date;
  updatedTo?: Date;
  limit?: number;
  offset?: number;
};

export async function listPurchaseOrders(ctx: ServiceCtx, args: ListPurchaseOrdersArgs = {}) {
  const filters: SQL[] = [eq(purchaseOrders.organizationId, ctx.orgId)];
  if (args.status) filters.push(eq(purchaseOrders.status, args.status));
  if (args.vendorId) filters.push(eq(purchaseOrders.vendorId, args.vendorId));
  if (args.search) filters.push(ilike(purchaseOrders.poNumber, `%${args.search}%`));
  if (args.updatedFrom) filters.push(gte(purchaseOrders.updatedAt, args.updatedFrom));
  if (args.updatedTo) filters.push(lte(purchaseOrders.updatedAt, args.updatedTo));
  const where = and(...filters);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);

  const rows = await db
    .select({ purchaseOrder: purchaseOrders, vendor: { id: companies.id, name: companies.name } })
    .from(purchaseOrders)
    .leftJoin(companies, eq(purchaseOrders.vendorId, companies.id))
    .where(where)
    .orderBy(desc(purchaseOrders.orderDate))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.purchaseOrder.id);
  const totals = new Map<string, { total: number; itemCount: number }>();
  if (ids.length) {
    const agg = await db
      .select({
        poId: purchaseOrderItems.purchaseOrderId,
        total: sql<string>`coalesce(sum(${purchaseOrderItems.quantity} * ${purchaseOrderItems.unitCost}), 0)`,
        items: count(),
      })
      .from(purchaseOrderItems)
      .where(inArray(purchaseOrderItems.purchaseOrderId, ids))
      .groupBy(purchaseOrderItems.purchaseOrderId);
    for (const a of agg) totals.set(a.poId, { total: Number(a.total), itemCount: Number(a.items) });
  }

  const [{ value: total }] = await db.select({ value: count() }).from(purchaseOrders).where(where);
  return {
    items: rows.map((r) => ({
      purchaseOrder: r.purchaseOrder,
      vendor: r.vendor?.id ? { id: r.vendor.id, name: r.vendor.name ?? "" } : null,
      total: totals.get(r.purchaseOrder.id)?.total ?? 0,
      itemCount: totals.get(r.purchaseOrder.id)?.itemCount ?? 0,
    })),
    total: Number(total),
    limit,
    offset,
  };
}

/**
 * Move a PO to a new status, applying the inventory consequence exactly once:
 * receiving posts a stock increment; leaving RECEIVED (to CANCELED) reverses it.
 */
export async function setPurchaseOrderStatus(
  ctx: ServiceCtx,
  id: string,
  next: PurchaseOrderStatus,
) {
  const current = await getPurchaseOrder(ctx, id);
  if (!current) throw new Error(`Purchase order ${id} not found.`);
  const from = current.purchaseOrder.status as PurchaseOrderStatus;
  if (from === next) return current;
  if (from === "CANCELED") throw new Error("A cancelled purchase order cannot change status.");

  const was = stockPosted(from);
  const will = stockPosted(next);
  if (!was && will) await moveStock(ctx, current.purchaseOrder, current.items, 1);
  else if (was && !will) await moveStock(ctx, current.purchaseOrder, current.items, -1);

  await db
    .update(purchaseOrders)
    .set({ status: next })
    .where(and(eq(purchaseOrders.organizationId, ctx.orgId), eq(purchaseOrders.id, id)));
  await recordAudit(ctx, {
    action: "purchase_order.status",
    entityType: "purchase_order",
    entityId: id,
    before: { status: from },
    after: { status: next },
  });
  return (await getPurchaseOrder(ctx, id))!;
}

export async function receivePurchaseOrder(ctx: ServiceCtx, id: string) {
  return setPurchaseOrderStatus(ctx, id, "RECEIVED");
}

// ---------------- Distru-faithful API serialization ----------------

export function purchaseOrderToApi(p: PurchaseOrderWithItems) {
  const r = p.purchaseOrder;
  return {
    id: r.id,
    po_number: r.poNumber,
    status: r.status,
    vendor: ref(p.vendor),
    location: ref(p.location),
    order_datetime: datetime(r.orderDate),
    total: num(p.total),
    notes: r.notes ?? null,
    items: p.items.map((i) => ({
      id: i.id,
      product_id: i.productId,
      sku: i.sku,
      name: i.name,
      quantity: num(i.quantity),
      unit_cost: num(i.unitCost),
      line_total: num(Number(i.quantity) * Number(i.unitCost)),
    })),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
