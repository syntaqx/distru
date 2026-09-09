import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, locations, orderCharges, orderItems, orders } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit, customData, datetime, num, ref, assertPositiveQuantities } from "../shared";
import { adjustInventory } from "../inventory";
import { getDefaultLocation } from "../catalog";
import { getMarketplaceProvider, getTraceabilityProvider } from "@/lib/integrations/sync";

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY_TO_SHIP"
  | "DELIVERING"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELED";

/** The forward fulfillment lifecycle (excludes the terminal CANCELED branch). */
export const ORDER_LIFECYCLE: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "READY_TO_SHIP",
  "DELIVERING",
  "DELIVERED",
  "COMPLETED",
];
export type ChargeKind = "FEE" | "DISCOUNT" | "SHIPPING" | "TAX";
export type OrderRow = typeof orders.$inferSelect;
export type OrderItemRow = typeof orderItems.$inferSelect;
export type OrderChargeRow = typeof orderCharges.$inferSelect;

/** A physical address; stored as JSONB, passed through verbatim on the API. */
export type Address = {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

export type CustomFields = Record<string, string | number | boolean | null>;

export type OrderItemInput = {
  productId?: string | null;
  sku?: string | null;
  name: string;
  quantity: number | string;
  unitPrice?: number | string | null;
};

export type OrderChargeInput = {
  name: string;
  kind?: ChargeKind;
  amount: number | string;
};

export type OrderInput = {
  orderNumber?: string;
  customerId?: string | null;
  locationId?: string | null;
  status?: OrderStatus;
  orderDate?: Date;
  notes?: string | null;
  charges?: OrderChargeInput[];
  billingAddress?: Address | null;
  shippingAddress?: Address | null;
  tags?: string[];
  customFields?: CustomFields;
  items: OrderItemInput[];
};

/** The money breakdown of an order: item subtotal, adjustments, and grand total. */
export type OrderTotals = {
  subtotal: number;
  chargeTotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
};

export type OrderWithItems = {
  order: OrderRow;
  customer: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  items: OrderItemRow[];
  charges: OrderChargeRow[];
  totals: OrderTotals;
  /** Grand total (kept for back-compat with callers reading `.total`). */
  total: number;
};

/** Compute the full money breakdown from line items and charges. */
export function computeOrderTotals(
  items: { quantity: string | number; unitPrice: string | number }[],
  charges: { kind?: string; amount: string | number }[] = [],
): OrderTotals {
  const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
  let chargeTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const c of charges) {
    const amt = Number(c.amount) || 0;
    if (c.kind === "DISCOUNT") discountTotal += amt;
    else if (c.kind === "TAX") taxTotal += amt;
    else chargeTotal += amt; // FEE, SHIPPING
  }
  const total = subtotal + chargeTotal + taxTotal - discountTotal;
  return { subtotal, chargeTotal, discountTotal, taxTotal, total };
}

/**
 * Stock is committed (decremented) once an order leaves PENDING into any active
 * fulfillment state; PENDING holds none and CANCELED restores it.
 */
function stockPosted(status: OrderStatus) {
  return status !== "PENDING" && status !== "CANCELED";
}

export function lineTotal(item: { quantity: string | number; unitPrice: string | number }) {
  return Number(item.quantity) * Number(item.unitPrice);
}

export function orderTotal(items: { quantity: string | number; unitPrice: string | number }[]) {
  return items.reduce((sum, i) => sum + lineTotal(i), 0);
}

/** Next per-org order number, e.g. SO-0001. */
export async function nextOrderNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.organizationId, ctx.orgId));
  return `SO-${String(Number(value) + 1).padStart(4, "0")}`;
}

/** Post (decrement) or restore stock for every line of an order at its location. */
async function moveStock(ctx: ServiceCtx, order: OrderRow, items: OrderItemRow[], direction: -1 | 1) {
  const locationId = order.locationId ?? (await getDefaultLocation(ctx)).id;
  for (const item of items) {
    if (!item.productId) continue;
    const qty = Number(item.quantity) * direction;
    if (qty === 0) continue;
    await adjustInventory(ctx, {
      productId: item.productId,
      locationId,
      delta: qty,
      reason: `sale:${order.orderNumber}`,
    });
  }
}

export async function createOrder(ctx: ServiceCtx, input: OrderInput) {
  if (!input.items || input.items.length === 0)
    throw new Error("An order needs at least one line item.");
  assertPositiveQuantities(input.items);
  const status = input.status ?? "PROCESSING";
  const orderNumber = input.orderNumber ?? (await nextOrderNumber(ctx));

  const [order] = await db
    .insert(orders)
    .values({
      organizationId: ctx.orgId,
      orderNumber,
      customerId: input.customerId ?? null,
      locationId: input.locationId ?? null,
      status,
      orderDate: input.orderDate ?? new Date(),
      notes: input.notes ?? null,
      billingAddress: input.billingAddress ?? null,
      shippingAddress: input.shippingAddress ?? null,
      tags: input.tags ?? [],
      customFields: input.customFields ?? {},
    })
    .returning();

  const items = await db
    .insert(orderItems)
    .values(
      input.items.map((i) => ({
        organizationId: ctx.orgId,
        orderId: order.id,
        productId: i.productId ?? null,
        sku: i.sku ?? null,
        name: i.name,
        quantity: String(i.quantity),
        unitPrice: String(i.unitPrice ?? 0),
      })),
    )
    .returning();

  if (input.charges?.length) {
    await db.insert(orderCharges).values(
      input.charges.map((c) => ({
        organizationId: ctx.orgId,
        orderId: order.id,
        name: c.name,
        kind: c.kind ?? "FEE",
        amount: String(c.amount),
      })),
    );
  }

  if (stockPosted(status)) await moveStock(ctx, order, items, -1);

  await recordAudit(ctx, {
    action: "order.create",
    entityType: "order",
    entityId: order.id,
    after: {
      orderNumber,
      status,
      lines: items.length,
      total: computeOrderTotals(items, input.charges ?? []).total,
    },
  });
  return (await getOrder(ctx, order.id))!;
}

export async function getOrder(ctx: ServiceCtx, id: string): Promise<OrderWithItems | null> {
  const [row] = await db
    .select({
      order: orders,
      customer: { id: companies.id, name: companies.name },
      location: { id: locations.id, name: locations.name },
    })
    .from(orders)
    .leftJoin(companies, eq(orders.customerId, companies.id))
    .leftJoin(locations, eq(orders.locationId, locations.id))
    .where(and(eq(orders.organizationId, ctx.orgId), eq(orders.id, id)))
    .limit(1);
  if (!row) return null;
  const [items, charges] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.createdAt)),
    db.select().from(orderCharges).where(eq(orderCharges.orderId, id)).orderBy(asc(orderCharges.createdAt)),
  ]);
  const totals = computeOrderTotals(items, charges);
  return {
    order: row.order,
    customer: row.customer?.id ? { id: row.customer.id, name: row.customer.name ?? "" } : null,
    location: row.location?.id ? { id: row.location.id, name: row.location.name ?? "" } : null,
    items,
    charges,
    totals,
    total: totals.total,
  };
}

export async function getOrderByNumber(ctx: ServiceCtx, orderNumber: string) {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.organizationId, ctx.orgId), eq(orders.orderNumber, orderNumber)))
    .limit(1);
  return row ? getOrder(ctx, row.id) : null;
}

export type ListOrdersArgs = {
  status?: OrderStatus;
  customerId?: string;
  search?: string;
  updatedFrom?: Date;
  updatedTo?: Date;
  limit?: number;
  offset?: number;
};

export type OrderListItem = {
  order: OrderRow;
  customer: { id: string; name: string } | null;
  total: number;
  itemCount: number;
};

export async function listOrders(ctx: ServiceCtx, args: ListOrdersArgs = {}) {
  const filters: SQL[] = [eq(orders.organizationId, ctx.orgId)];
  if (args.status) filters.push(eq(orders.status, args.status));
  if (args.customerId) filters.push(eq(orders.customerId, args.customerId));
  if (args.search) filters.push(ilike(orders.orderNumber, `%${args.search}%`));
  if (args.updatedFrom) filters.push(gte(orders.updatedAt, args.updatedFrom));
  if (args.updatedTo) filters.push(lte(orders.updatedAt, args.updatedTo));
  const where = and(...filters);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);

  const rows = await db
    .select({
      order: orders,
      customer: { id: companies.id, name: companies.name },
    })
    .from(orders)
    .leftJoin(companies, eq(orders.customerId, companies.id))
    .where(where)
    .orderBy(desc(orders.orderDate))
    .limit(limit)
    .offset(offset);

  const ids = rows.map((r) => r.order.id);
  const totals = new Map<string, { total: number; itemCount: number }>();
  if (ids.length) {
    const [itemAgg, chargeAgg] = await Promise.all([
      db
        .select({
          orderId: orderItems.orderId,
          subtotal: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`,
          items: count(),
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, ids))
        .groupBy(orderItems.orderId),
      db
        .select({
          orderId: orderCharges.orderId,
          net: sql<string>`coalesce(sum(case when ${orderCharges.kind} = 'DISCOUNT' then -${orderCharges.amount} else ${orderCharges.amount} end), 0)`,
        })
        .from(orderCharges)
        .where(inArray(orderCharges.orderId, ids))
        .groupBy(orderCharges.orderId),
    ]);
    const chargeById = new Map(chargeAgg.map((c) => [c.orderId, Number(c.net)]));
    for (const a of itemAgg)
      totals.set(a.orderId, {
        total: Number(a.subtotal) + (chargeById.get(a.orderId) ?? 0),
        itemCount: Number(a.items),
      });
  }

  const [{ value: total }] = await db.select({ value: count() }).from(orders).where(where);

  const items: OrderListItem[] = rows.map((r) => ({
    order: r.order,
    customer: r.customer?.id ? { id: r.customer.id, name: r.customer.name ?? "" } : null,
    total: totals.get(r.order.id)?.total ?? 0,
    itemCount: totals.get(r.order.id)?.itemCount ?? 0,
  }));
  return { items, total: Number(total), limit, offset };
}

/**
 * Move an order to a new status, applying the inventory consequence exactly
 * once: draft/cancelled hold no stock, confirmed/fulfilled do, so the delta
 * between the two states is what gets posted or restored.
 */
export async function setOrderStatus(ctx: ServiceCtx, id: string, next: OrderStatus) {
  const current = await getOrder(ctx, id);
  if (!current) throw new Error(`Order ${id} not found.`);
  const from = current.order.status as OrderStatus;
  if (from === next) return current;
  if (from === "CANCELED")
    throw new Error("A canceled order cannot change status.");

  const was = stockPosted(from);
  const will = stockPosted(next);
  if (!was && will) await moveStock(ctx, current.order, current.items, -1);
  else if (was && !will) await moveStock(ctx, current.order, current.items, 1);

  await db
    .update(orders)
    .set({ status: next })
    .where(and(eq(orders.organizationId, ctx.orgId), eq(orders.id, id)));
  await recordAudit(ctx, {
    action: next === "CANCELED" ? "order.cancel" : "order.status",
    entityType: "order",
    entityId: id,
    before: { status: from },
    after: { status: next },
  });
  return (await getOrder(ctx, id))!;
}

export function cancelOrder(ctx: ServiceCtx, id: string) {
  return setOrderStatus(ctx, id, "CANCELED");
}

// ---------------- Import support (draft orders, appended line by line) ----------------

/** Find an order by number, or create it as a DRAFT (imports land as drafts to review). */
export async function findOrCreateDraftOrder(
  ctx: ServiceCtx,
  input: { orderNumber: string; customerId?: string | null; orderDate?: Date },
) {
  const existing = await getOrderByNumber(ctx, input.orderNumber);
  if (existing) return existing.order;
  const [row] = await db
    .insert(orders)
    .values({
      organizationId: ctx.orgId,
      orderNumber: input.orderNumber,
      customerId: input.customerId ?? null,
      status: "PENDING",
      orderDate: input.orderDate ?? new Date(),
    })
    .returning();
  await recordAudit(ctx, {
    action: "order.create",
    entityType: "order",
    entityId: row.id,
    after: { orderNumber: row.orderNumber, status: "PENDING", source: "import" },
  });
  return row;
}

export async function addOrderItem(ctx: ServiceCtx, orderId: string, item: OrderItemInput) {
  const [row] = await db
    .insert(orderItems)
    .values({
      organizationId: ctx.orgId,
      orderId,
      productId: item.productId ?? null,
      sku: item.sku ?? null,
      name: item.name,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice ?? 0),
    })
    .returning();
  return row;
}

// ---------------- Distru-faithful API serialization ----------------

export function orderToApi(o: OrderWithItems) {
  const r = o.order;
  return {
    id: r.id,
    order_number: r.orderNumber,
    status: r.status,
    company: ref(o.customer),
    location: ref(o.location),
    order_datetime: datetime(r.orderDate),
    subtotal: num(o.totals.subtotal),
    charge_total: num(o.totals.chargeTotal),
    discount_total: num(o.totals.discountTotal),
    tax_total: num(o.totals.taxTotal),
    total: num(o.totals.total),
    internal_notes: r.notes ?? null,
    external_notes: null,
    billing_location: (r.billingAddress as Address | null) ?? null,
    shipping_location: (r.shippingAddress as Address | null) ?? null,
    tags: r.tags ?? [],
    custom_data: customData(r.customFields),
    items: o.items.map((i) => ({
      id: i.id,
      product: { id: i.productId, name: i.name, sku: i.sku ?? null },
      quantity: num(i.quantity),
      price: num(i.unitPrice),
      line_total: num(lineTotal(i)),
    })),
    charges: o.charges.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      amount: num(c.amount),
    })),
    // Distru-parity fields not modeled in this clone (null/empty; see
    // DISTRU-PARITY.md §5 Tier 3) — audit, related docs, and integration ids.
    owner: null,
    creator: null,
    tasks: [],
    invoices: [],
    returns: [],
    combined_order: null,
    menu: null,
    buyer_company: null,
    delivery_datetime: null,
    delivered_datetime: null,
    due_datetime: null,
    payment_term_name: null,
    blaze_payment_type: null,
    metrc_transfer_id: getTraceabilityProvider().metrcTransferId(r.id),
    metrc_transfer_template_id: getTraceabilityProvider().metrcTransferTemplateId(r.id),
    metrc_transfer_template_status: null,
    metrc_transfer_template_error: null,
    biotrack_id: getTraceabilityProvider().biotrackId(r.id),
    leaflink_id: getMarketplaceProvider().orderId(r.id),
    leaflink_order_number: getMarketplaceProvider().orderNumber(r.id),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
