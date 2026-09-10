import { and, asc, count, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, deliveries, deliveryRoutes, drivers, orders, vehicles } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { datetime } from "../shared";
import {
  getOrder,
  setOrderStatus,
  ORDER_LIFECYCLE,
  type Address,
  type OrderStatus,
} from "../sales";

export type DeliveryStatus = "DRAFT" | "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "FAILED";

/** Forward dispatch lifecycle (excludes the terminal FAILED branch). */
export const DELIVERY_LIFECYCLE: DeliveryStatus[] = [
  "DRAFT",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export type DeliveryRow = typeof deliveries.$inferSelect;
export type DeliveryRouteRow = typeof deliveryRoutes.$inferSelect;

/** A delivery joined with the human-readable names it references. */
export type DeliveryEnriched = {
  delivery: DeliveryRow;
  orderNumber: string | null;
  customer: { id: string; name: string } | null;
  driver: { id: string; name: string } | null;
  vehicle: { id: string; name: string } | null;
};

export type DeliveryInput = {
  id?: string;
  orderId?: string | null;
  routeId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  status?: DeliveryStatus;
  address?: Address | null;
  lat?: number | null;
  lng?: number | null;
  sequence?: number | null;
  scheduledAt?: Date | null;
  deliveredAt?: Date | null;
  notes?: string | null;
};

/** Format a numeric coordinate for the DB, or null. */
function coord(v: number | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return Number.isFinite(v) ? Number(v).toFixed(6) : null;
}

/**
 * Advance the order behind a delivery toward `target`, but only ever FORWARD
 * along the sales lifecycle (never regress a COMPLETED order, never touch a
 * CANCELED one). Best-effort: a delivery status change must not fail because the
 * order refused the transition, so this swallows sales-side errors.
 */
async function nudgeOrder(ctx: ServiceCtx, orderId: string | null, target: OrderStatus) {
  if (!orderId) return;
  try {
    const current = await getOrder(ctx, orderId);
    if (!current) return;
    const from = current.order.status as OrderStatus;
    if (from === "CANCELED") return;
    const fromIdx = ORDER_LIFECYCLE.indexOf(from);
    const toIdx = ORDER_LIFECYCLE.indexOf(target);
    if (toIdx < 0 || fromIdx < 0 || toIdx <= fromIdx) return; // only move forward
    await setOrderStatus(ctx, orderId, target);
  } catch {
    // The delivery is the source of truth here; tracking never blocks on sales.
  }
}

/** The order-status a delivery status maps onto, or null when it should not nudge. */
function orderStatusFor(status: DeliveryStatus): OrderStatus | null {
  if (status === "OUT_FOR_DELIVERY") return "DELIVERING";
  if (status === "DELIVERED") return "DELIVERED";
  return null;
}

/**
 * Create a delivery for an order. Snapshots the order's shipping address (falling
 * back to billing) unless one is passed, and lands as ASSIGNED when a driver is
 * given, else DRAFT.
 */
export async function createDeliveryFromOrder(
  ctx: ServiceCtx,
  input: {
    orderId: string;
    driverId?: string | null;
    vehicleId?: string | null;
    routeId?: string | null;
    scheduledAt?: Date | null;
    sequence?: number | null;
    notes?: string | null;
    address?: Address | null;
    lat?: number | null;
    lng?: number | null;
  },
) {
  const order = await getOrder(ctx, input.orderId);
  if (!order) throw new Error("Order not found.");
  const snapshot =
    input.address ??
    (order.order.shippingAddress as Address | null) ??
    (order.order.billingAddress as Address | null) ??
    null;
  const status: DeliveryStatus = input.driverId ? "ASSIGNED" : "DRAFT";
  const [row] = await db
    .insert(deliveries)
    .values({
      organizationId: ctx.orgId,
      orderId: input.orderId,
      routeId: input.routeId ?? null,
      driverId: input.driverId ?? null,
      vehicleId: input.vehicleId ?? null,
      status,
      address: snapshot ?? null,
      lat: coord(input.lat) ?? null,
      lng: coord(input.lng) ?? null,
      sequence: input.sequence ?? null,
      scheduledAt: input.scheduledAt ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return { row, created: true };
}

/** Sparse upsert: with id updates only the fields sent; without id creates. */
export async function upsertDelivery(ctx: ServiceCtx, input: DeliveryInput) {
  if (input.id) {
    const existing = await getDelivery(ctx, input.id);
    if (!existing) throw new Error("Delivery not found.");
    const [row] = await db
      .update(deliveries)
      .set({
        ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
        ...(input.routeId !== undefined ? { routeId: input.routeId } : {}),
        ...(input.driverId !== undefined ? { driverId: input.driverId } : {}),
        ...(input.vehicleId !== undefined ? { vehicleId: input.vehicleId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.lat !== undefined ? { lat: coord(input.lat) ?? null } : {}),
        ...(input.lng !== undefined ? { lng: coord(input.lng) ?? null } : {}),
        ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
        ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.deliveredAt !== undefined ? { deliveredAt: input.deliveredAt } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(deliveries.organizationId, ctx.orgId), eq(deliveries.id, input.id)))
      .returning();
    if (input.status) await nudgeOrderFor(ctx, row);
    return { row, created: false };
  }
  if (!input.orderId) throw new Error("order_id is required to create a delivery.");
  return createDeliveryFromOrder(ctx, {
    orderId: input.orderId,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    routeId: input.routeId,
    scheduledAt: input.scheduledAt,
    sequence: input.sequence,
    notes: input.notes,
    address: input.address ?? undefined,
    lat: input.lat,
    lng: input.lng,
  });
}

async function nudgeOrderFor(ctx: ServiceCtx, row: DeliveryRow) {
  const target = orderStatusFor(row.status as DeliveryStatus);
  if (target) await nudgeOrder(ctx, row.orderId, target);
}

/** Assign a driver (+ optional vehicle/schedule/stop) and move to ASSIGNED. */
export async function assignDelivery(
  ctx: ServiceCtx,
  id: string,
  input: {
    driverId: string;
    vehicleId?: string | null;
    routeId?: string | null;
    scheduledAt?: Date | null;
    sequence?: number | null;
  },
) {
  const existing = await getDelivery(ctx, id);
  if (!existing) throw new Error("Delivery not found.");
  // Assigning re-opens a DRAFT/FAILED delivery; an in-flight one keeps its status.
  const keep = existing.status === "OUT_FOR_DELIVERY" || existing.status === "DELIVERED";
  const [row] = await db
    .update(deliveries)
    .set({
      driverId: input.driverId,
      ...(input.vehicleId !== undefined ? { vehicleId: input.vehicleId } : {}),
      ...(input.routeId !== undefined ? { routeId: input.routeId } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
      ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
      ...(keep ? {} : { status: "ASSIGNED" as const }),
      updatedAt: new Date(),
    })
    .where(and(eq(deliveries.organizationId, ctx.orgId), eq(deliveries.id, id)))
    .returning();
  return row;
}

/**
 * Advance a delivery to `next`, applying the side effects exactly once: DELIVERED
 * stamps `deliveredAt` and nudges the order to DELIVERED; OUT_FOR_DELIVERY nudges
 * the order to DELIVERING. FAILED and backwards moves just record the status.
 */
export async function advanceDeliveryStatus(ctx: ServiceCtx, id: string, next: DeliveryStatus) {
  const existing = await getDelivery(ctx, id);
  if (!existing) throw new Error("Delivery not found.");
  const [row] = await db
    .update(deliveries)
    .set({
      status: next,
      ...(next === "DELIVERED"
        ? { deliveredAt: existing.deliveredAt ?? new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(deliveries.organizationId, ctx.orgId), eq(deliveries.id, id)))
    .returning();
  await nudgeOrderFor(ctx, row);
  return row;
}

export async function getDelivery(ctx: ServiceCtx, id: string): Promise<DeliveryRow | null> {
  const [row] = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.organizationId, ctx.orgId), eq(deliveries.id, id)))
    .limit(1);
  return row ?? null;
}

export async function getDeliveryEnriched(
  ctx: ServiceCtx,
  id: string,
): Promise<DeliveryEnriched | null> {
  const [row] = await enrichedQuery(ctx, [eq(deliveries.id, id)]).limit(1);
  return row ? toEnriched(row) : null;
}

type EnrichedSelectRow = {
  delivery: DeliveryRow;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  vehicleName: string | null;
};

function enrichedQuery(ctx: ServiceCtx, extra: SQL[]) {
  return db
    .select({
      delivery: deliveries,
      orderNumber: orders.orderNumber,
      customerId: companies.id,
      customerName: companies.name,
      driverId: drivers.id,
      driverName: drivers.name,
      vehicleId: vehicles.id,
      vehicleName: vehicles.name,
    })
    .from(deliveries)
    .leftJoin(orders, eq(deliveries.orderId, orders.id))
    .leftJoin(companies, eq(orders.customerId, companies.id))
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(vehicles, eq(deliveries.vehicleId, vehicles.id))
    .where(and(eq(deliveries.organizationId, ctx.orgId), ...extra))
    .$dynamic();
}

function toEnriched(r: EnrichedSelectRow): DeliveryEnriched {
  return {
    delivery: r.delivery,
    orderNumber: r.orderNumber ?? null,
    customer: r.customerId ? { id: r.customerId, name: r.customerName ?? "" } : null,
    driver: r.driverId ? { id: r.driverId, name: r.driverName ?? "" } : null,
    vehicle: r.vehicleId ? { id: r.vehicleId, name: r.vehicleName ?? "" } : null,
  };
}

export type ListDeliveriesArgs = {
  status?: DeliveryStatus;
  driverId?: string;
  orderId?: string;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  limit?: number;
  offset?: number;
};

export async function listDeliveries(ctx: ServiceCtx, args: ListDeliveriesArgs = {}) {
  const filters: SQL[] = [];
  if (args.status) filters.push(eq(deliveries.status, args.status));
  if (args.driverId) filters.push(eq(deliveries.driverId, args.driverId));
  if (args.orderId) filters.push(eq(deliveries.orderId, args.orderId));
  if (args.scheduledFrom) filters.push(gte(deliveries.scheduledAt, args.scheduledFrom));
  if (args.scheduledTo) filters.push(lt(deliveries.scheduledAt, args.scheduledTo));
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);

  const rows = await enrichedQuery(ctx, filters)
    .orderBy(asc(deliveries.sequence), desc(deliveries.createdAt))
    .limit(limit)
    .offset(offset);

  const where = filters.length
    ? and(eq(deliveries.organizationId, ctx.orgId), ...filters)
    : eq(deliveries.organizationId, ctx.orgId);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(deliveries)
    .where(where);

  return { items: rows.map(toEnriched), total: Number(total), limit, offset };
}

/**
 * A driver's manifest for a day: every delivery scheduled that date, ordered by
 * stop sequence, plus a compact status tally. `date` is a local-day string
 * (YYYY-MM-DD) or a Date; the window is [midnight, next midnight).
 */
export async function driverManifest(ctx: ServiceCtx, driverId: string, date: Date | string) {
  const day = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);

  const rows = await enrichedQuery(ctx, [
    eq(deliveries.driverId, driverId),
    gte(deliveries.scheduledAt, day),
    lt(deliveries.scheduledAt, next),
  ]).orderBy(asc(deliveries.sequence), asc(deliveries.createdAt));

  const stops = rows.map(toEnriched);
  const tally: Record<DeliveryStatus, number> = {
    DRAFT: 0,
    ASSIGNED: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    FAILED: 0,
  };
  for (const s of stops) tally[s.delivery.status as DeliveryStatus]++;

  const [driver] = await db
    .select({ id: drivers.id, name: drivers.name })
    .from(drivers)
    .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.id, driverId)))
    .limit(1);

  return {
    driver: driver ?? null,
    date: day.toISOString().slice(0, 10),
    stops,
    total: stops.length,
    delivered: tally.DELIVERED,
    tally,
  };
}

// ---------------- Routes (named grouping of a driver's stops for a day) ----------------

export async function upsertRoute(
  ctx: ServiceCtx,
  input: {
    id?: string;
    name?: string;
    driverId?: string | null;
    vehicleId?: string | null;
    routeDate?: string | null;
    notes?: string | null;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(deliveryRoutes)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.driverId !== undefined ? { driverId: input.driverId } : {}),
        ...(input.vehicleId !== undefined ? { vehicleId: input.vehicleId } : {}),
        ...(input.routeDate !== undefined ? { routeDate: input.routeDate } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(deliveryRoutes.organizationId, ctx.orgId), eq(deliveryRoutes.id, input.id)))
      .returning();
    if (!row) throw new Error("Route not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(deliveryRoutes)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      driverId: input.driverId ?? null,
      vehicleId: input.vehicleId ?? null,
      routeDate: input.routeDate ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return { row, created: true };
}

export async function listRoutes(ctx: ServiceCtx, opts: { limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const items = await db
    .select()
    .from(deliveryRoutes)
    .where(eq(deliveryRoutes.organizationId, ctx.orgId))
    .orderBy(desc(deliveryRoutes.routeDate), desc(deliveryRoutes.createdAt))
    .limit(limit);
  return { items };
}

/** Count deliveries grouped by status for the org (dashboard/board headers). */
export async function deliveryStatusCounts(ctx: ServiceCtx): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: deliveries.status, value: count() })
    .from(deliveries)
    .where(eq(deliveries.organizationId, ctx.orgId))
    .groupBy(deliveries.status);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.value);
  return out;
}

/** Order ids that already have a delivery, so callers can offer only the rest. */
export async function orderIdsWithDeliveries(ctx: ServiceCtx, orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();
  const rows = await db
    .select({ orderId: deliveries.orderId })
    .from(deliveries)
    .where(and(eq(deliveries.organizationId, ctx.orgId), inArray(deliveries.orderId, orderIds)));
  const set = new Set<string>();
  for (const r of rows) if (r.orderId) set.add(r.orderId);
  return set;
}

// ---------------- Distru-faithful API serialization ----------------

export function deliveryToApi(d: DeliveryEnriched) {
  const r = d.delivery;
  return {
    id: r.id,
    status: r.status,
    order: r.orderId ? { id: r.orderId, order_number: d.orderNumber } : null,
    company: d.customer ? { id: d.customer.id, name: d.customer.name } : null,
    driver: d.driver ? { id: d.driver.id, name: d.driver.name } : null,
    vehicle: d.vehicle ? { id: d.vehicle.id, name: d.vehicle.name } : null,
    route_id: r.routeId ?? null,
    sequence: r.sequence ?? null,
    address: (r.address as Record<string, string | null> | null) ?? null,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    scheduled_datetime: datetime(r.scheduledAt),
    delivered_datetime: datetime(r.deliveredAt),
    notes: r.notes ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
