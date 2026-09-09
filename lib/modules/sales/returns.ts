import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, locations, returnItems, returns } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit, datetime, num, ref, assertPositiveQuantities } from "../shared";
import { adjustInventory } from "@/lib/modules/inventory";
import { getDefaultLocation } from "@/lib/modules/catalog";

export type ReturnStatus = "DRAFT" | "RECEIVED" | "CANCELED";
export type ReturnRow = typeof returns.$inferSelect;
export type ReturnItemRow = typeof returnItems.$inferSelect;

export type ReturnItemInput = {
  productId?: string | null;
  sku?: string | null;
  name: string;
  quantity: number | string;
  unitPrice?: number | string | null;
};

export type ReturnInput = {
  returnNumber?: string;
  orderId?: string | null;
  customerId?: string | null;
  locationId?: string | null;
  status?: ReturnStatus;
  reason?: string | null;
  returnDate?: Date;
  notes?: string | null;
  items: ReturnItemInput[];
};

export type ReturnWithItems = {
  return: ReturnRow;
  customer: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  items: ReturnItemRow[];
  total: number;
};

/** A received return has restocked its lines; draft/cancelled has not. */
function stockPosted(status: ReturnStatus) {
  return status === "RECEIVED";
}

export function returnTotal(items: { quantity: string | number; unitPrice: string | number }[]) {
  return items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);
}

/** Next per-org return number, e.g. RET-0001. */
export async function nextReturnNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(returns)
    .where(eq(returns.organizationId, ctx.orgId));
  return `RET-${String(Number(value) + 1).padStart(4, "0")}`;
}

/** Restock (+1) or reverse (-1) the returned lines at the return's location. */
async function moveStock(ctx: ServiceCtx, ret: ReturnRow, items: ReturnItemRow[], direction: -1 | 1) {
  const locationId = ret.locationId ?? (await getDefaultLocation(ctx)).id;
  for (const item of items) {
    if (!item.productId) continue;
    const qty = Number(item.quantity) * direction;
    if (qty === 0) continue;
    await adjustInventory(ctx, {
      productId: item.productId,
      locationId,
      delta: qty,
      reason: `return:${ret.returnNumber}`,
    });
  }
}

export async function createReturn(ctx: ServiceCtx, input: ReturnInput) {
  if (!input.items || input.items.length === 0)
    throw new Error("A return needs at least one line item.");
  assertPositiveQuantities(input.items);
  const status = input.status ?? "RECEIVED";
  const returnNumber = input.returnNumber ?? (await nextReturnNumber(ctx));

  const [ret] = await db
    .insert(returns)
    .values({
      organizationId: ctx.orgId,
      returnNumber,
      orderId: input.orderId ?? null,
      customerId: input.customerId ?? null,
      locationId: input.locationId ?? null,
      status,
      reason: input.reason ?? null,
      returnDate: input.returnDate ?? new Date(),
      notes: input.notes ?? null,
    })
    .returning();

  const items = await db
    .insert(returnItems)
    .values(
      input.items.map((i) => ({
        organizationId: ctx.orgId,
        returnId: ret.id,
        productId: i.productId ?? null,
        sku: i.sku ?? null,
        name: i.name,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice ?? 0),
      })),
    )
    .returning();

  if (stockPosted(status)) await moveStock(ctx, ret, items, 1);

  await recordAudit(ctx, {
    action: "return.create",
    entityType: "return",
    entityId: ret.id,
    after: { returnNumber, status, lines: items.length, total: returnTotal(items) },
  });
  return (await getReturn(ctx, ret.id))!;
}

export async function getReturn(ctx: ServiceCtx, id: string): Promise<ReturnWithItems | null> {
  const [row] = await db
    .select({
      return: returns,
      customer: { id: companies.id, name: companies.name },
      location: { id: locations.id, name: locations.name },
    })
    .from(returns)
    .leftJoin(companies, eq(returns.customerId, companies.id))
    .leftJoin(locations, eq(returns.locationId, locations.id))
    .where(and(eq(returns.organizationId, ctx.orgId), eq(returns.id, id)))
    .limit(1);
  if (!row) return null;
  const items = await db
    .select()
    .from(returnItems)
    .where(eq(returnItems.returnId, id))
    .orderBy(asc(returnItems.createdAt));
  return {
    return: row.return,
    customer: row.customer?.id ? { id: row.customer.id, name: row.customer.name ?? "" } : null,
    location: row.location?.id ? { id: row.location.id, name: row.location.name ?? "" } : null,
    items,
    total: returnTotal(items),
  };
}

export async function getReturnByNumber(ctx: ServiceCtx, returnNumber: string) {
  const [row] = await db
    .select({ id: returns.id })
    .from(returns)
    .where(and(eq(returns.organizationId, ctx.orgId), eq(returns.returnNumber, returnNumber)))
    .limit(1);
  return row ? getReturn(ctx, row.id) : null;
}

export type ListReturnsArgs = {
  status?: ReturnStatus;
  customerId?: string;
  search?: string;
  updatedFrom?: Date;
  updatedTo?: Date;
  limit?: number;
  offset?: number;
};

export async function listReturns(ctx: ServiceCtx, args: ListReturnsArgs = {}) {
  const filters: SQL[] = [eq(returns.organizationId, ctx.orgId)];
  if (args.status) filters.push(eq(returns.status, args.status));
  if (args.customerId) filters.push(eq(returns.customerId, args.customerId));
  if (args.search) filters.push(ilike(returns.returnNumber, `%${args.search}%`));
  if (args.updatedFrom) filters.push(gte(returns.updatedAt, args.updatedFrom));
  if (args.updatedTo) filters.push(lte(returns.updatedAt, args.updatedTo));
  const where = and(...filters);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);

  const rows = await db
    .select({ return: returns, customer: { id: companies.id, name: companies.name } })
    .from(returns)
    .leftJoin(companies, eq(returns.customerId, companies.id))
    .where(where)
    .orderBy(desc(returns.returnDate))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.return.id);
  const totals = new Map<string, { total: number; itemCount: number }>();
  if (ids.length) {
    const agg = await db
      .select({
        returnId: returnItems.returnId,
        total: sql<string>`coalesce(sum(${returnItems.quantity} * ${returnItems.unitPrice}), 0)`,
        items: count(),
      })
      .from(returnItems)
      .where(inArray(returnItems.returnId, ids))
      .groupBy(returnItems.returnId);
    for (const a of agg) totals.set(a.returnId, { total: Number(a.total), itemCount: Number(a.items) });
  }

  const [{ value: total }] = await db.select({ value: count() }).from(returns).where(where);
  return {
    items: rows.map((r) => ({
      return: r.return,
      customer: r.customer?.id ? { id: r.customer.id, name: r.customer.name ?? "" } : null,
      total: totals.get(r.return.id)?.total ?? 0,
      itemCount: totals.get(r.return.id)?.itemCount ?? 0,
    })),
    total: Number(total),
    limit,
    offset,
  };
}

export async function setReturnStatus(ctx: ServiceCtx, id: string, next: ReturnStatus) {
  const current = await getReturn(ctx, id);
  if (!current) throw new Error(`Return ${id} not found.`);
  const from = current.return.status as ReturnStatus;
  if (from === next) return current;
  if (from === "CANCELED") throw new Error("A cancelled return cannot change status.");

  const was = stockPosted(from);
  const will = stockPosted(next);
  if (!was && will) await moveStock(ctx, current.return, current.items, 1);
  else if (was && !will) await moveStock(ctx, current.return, current.items, -1);

  await db
    .update(returns)
    .set({ status: next })
    .where(and(eq(returns.organizationId, ctx.orgId), eq(returns.id, id)));
  await recordAudit(ctx, {
    action: "return.status",
    entityType: "return",
    entityId: id,
    before: { status: from },
    after: { status: next },
  });
  return (await getReturn(ctx, id))!;
}

// ---------------- Distru-faithful API serialization ----------------

export function returnToApi(r: ReturnWithItems) {
  const row = r.return;
  return {
    id: row.id,
    return_number: row.returnNumber,
    status: row.status,
    order_id: row.orderId,
    customer: ref(r.customer),
    location: ref(r.location),
    reason: row.reason ?? null,
    return_datetime: datetime(row.returnDate),
    total: num(r.total),
    notes: row.notes ?? null,
    items: r.items.map((i) => ({
      id: i.id,
      product_id: i.productId,
      sku: i.sku,
      name: i.name,
      quantity: num(i.quantity),
      unit_price: num(i.unitPrice),
      line_total: num(Number(i.quantity) * Number(i.unitPrice)),
    })),
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}
