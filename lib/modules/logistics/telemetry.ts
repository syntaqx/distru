import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  deliveries,
  drivers,
  orders,
  telemetryPings,
  vehicleTelemetry,
  vehicles,
} from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { datetime } from "../shared";
import type { Address } from "../sales";
import { advanceDeliveryStatus } from "./deliveries";

/**
 * Vehicle telemetry - the "live" layer over the fleet. A single last-known ping
 * per vehicle (upserted in place) drives the dispatch map; a deterministic
 * simulator advances each EN_ROUTE vehicle one step toward its current stop so
 * the persisted snapshot can be "advanced" through the operating day without any
 * background loop. Everything here is mocked but coherent - real Austin coords,
 * real bearings, real arrivals.
 */

export type TelemetryStatus = "IDLE" | "EN_ROUTE" | "STOPPED" | "RETURNING";

// Austin, TX operating area. The dispatch map is a viewport over this box; the
// depot sits central (near downtown). Exported so the seed, service, and UI all
// agree on the same coordinate frame.
export const AUSTIN_BOUNDS = {
  south: 30.15,
  north: 30.45,
  west: -97.95,
  east: -97.55,
} as const;

export const AUSTIN_DEPOT = { lat: 30.2672, lng: -97.7431 } as const;

/** Clamp a coordinate into the Austin viewport so a marker can never drift off-map. */
function clamp(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.min(AUSTIN_BOUNDS.north, Math.max(AUSTIN_BOUNDS.south, lat)),
    lng: Math.min(AUSTIN_BOUNDS.east, Math.max(AUSTIN_BOUNDS.west, lng)),
  };
}

const toNum = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

// ---- Geometry (equirectangular, fine at city scale) --------------------------

/** Rough distance in miles between two lat/lng points (city-scale approximation). */
function distanceMiles(a: LatLng, b: LatLng): number {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (b.lng - a.lng) * Math.cos(midLat) * 69.172;
  const dy = (b.lat - a.lat) * 69.172;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compass bearing (0=N, 90=E) from `a` to `b`, as an integer 0-359. */
function bearingDeg(a: LatLng, b: LatLng): number {
  const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (b.lng - a.lng) * Math.cos(midLat);
  const dy = b.lat - a.lat;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

type LatLng = { lat: number; lng: number };

// ---- Types -------------------------------------------------------------------

export type TelemetryRow = typeof vehicleTelemetry.$inferSelect;

export type TelemetryInput = {
  vehicleId: string;
  lat: number;
  lng: number;
  speedMph?: number;
  headingDeg?: number;
  status?: TelemetryStatus;
  currentDeliveryId?: string | null;
  recordPing?: boolean;
};

export type FleetVehicleTelemetry = {
  vehicle: {
    id: string;
    name: string;
    make: string | null;
    model: string | null;
    licensePlate: string | null;
    baseLat: number | null;
    baseLng: number | null;
  };
  telemetry: {
    lat: number;
    lng: number;
    speedMph: number;
    headingDeg: number;
    status: TelemetryStatus;
    updatedAt: string | null;
  } | null;
  driver: { id: string; name: string } | null;
  currentDelivery: {
    id: string;
    orderNumber: string | null;
    customer: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    sequence: number | null;
    status: string;
    etaMinutes: number | null;
  } | null;
  stats: { deliveredToday: number; remainingToday: number; totalToday: number };
};

export type FleetTelemetry = {
  depot: LatLng;
  bounds: typeof AUSTIN_BOUNDS;
  vehicles: FleetVehicleTelemetry[];
  stops: {
    id: string;
    orderNumber: string | null;
    customer: string | null;
    address: string | null;
    lat: number;
    lng: number;
    status: string;
    sequence: number | null;
  }[];
  /**
   * Today's stops grouped into each driver's run, ordered by stop sequence - so
   * the map can draw one route line per driver (depot -> stops) and the operator
   * can see every driver's routes and stops for the area at a glance.
   */
  routes: {
    driverId: string;
    driverName: string;
    vehicleId: string | null;
    stops: {
      id: string;
      lat: number;
      lng: number;
      sequence: number | null;
      status: string;
      customer: string | null;
      orderNumber: string | null;
      address: string | null;
    }[];
  }[];
  fleet: { enRoute: number; idle: number; returning: number; stopsRemaining: number };
};

// ---- Read --------------------------------------------------------------------

/** Assumed average urban speed (mph) used to estimate an ETA from distance. */
const AVG_MPH = 22;

/**
 * The full dispatch snapshot: every vehicle with its latest telemetry, the
 * delivery it's currently running (with destination coords + a distance-based
 * ETA), its driver, and per-vehicle + fleet-wide counts. Also returns today's
 * geocoded stops so the map can plot them. This is what both the Dispatch UI and
 * the public telemetry endpoint render.
 */
export async function getFleetTelemetry(ctx: ServiceCtx): Promise<FleetTelemetry> {
  const vehicleRows = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.organizationId, ctx.orgId))
    .orderBy(asc(vehicles.name));

  const telemetryRows = await db
    .select()
    .from(vehicleTelemetry)
    .where(eq(vehicleTelemetry.organizationId, ctx.orgId));
  const telByVehicle = new Map(telemetryRows.map((t) => [t.vehicleId, t]));

  // Today's deliveries (for per-vehicle done/remaining tallies + the map's stops).
  const { start, end } = todayWindow();
  const todays = await db
    .select({
      delivery: deliveries,
      orderNumber: orders.orderNumber,
      customerName: companies.name,
      driverId: drivers.id,
      driverName: drivers.name,
    })
    .from(deliveries)
    .leftJoin(orders, eq(deliveries.orderId, orders.id))
    .leftJoin(companies, eq(orders.customerId, companies.id))
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .where(
      and(
        eq(deliveries.organizationId, ctx.orgId),
        gte(deliveries.scheduledAt, start),
        lt(deliveries.scheduledAt, end),
      ),
    )
    .orderBy(asc(deliveries.sequence));

  const deliveryById = new Map(todays.map((d) => [d.delivery.id, d]));

  const vehiclesOut: FleetVehicleTelemetry[] = vehicleRows.map((v) => {
    const t = telByVehicle.get(v.id);
    const forVehicle = todays.filter((d) => d.delivery.vehicleId === v.id);
    const deliveredToday = forVehicle.filter((d) => d.delivery.status === "DELIVERED").length;
    const remainingToday = forVehicle.filter(
      (d) => d.delivery.status === "OUT_FOR_DELIVERY" || d.delivery.status === "ASSIGNED",
    ).length;

    // Driver: from the current delivery, else from any of today's stops for this vehicle.
    const cur = t?.currentDeliveryId ? deliveryById.get(t.currentDeliveryId) : undefined;
    const driverSource = cur ?? forVehicle.find((d) => d.driverId);
    const driver = driverSource?.driverId
      ? { id: driverSource.driverId, name: driverSource.driverName ?? "" }
      : null;

    let currentDelivery: FleetVehicleTelemetry["currentDelivery"] = null;
    if (cur) {
      const dLat = toNum(cur.delivery.lat);
      const dLng = toNum(cur.delivery.lng);
      let etaMinutes: number | null = null;
      if (t && dLat != null && dLng != null) {
        const miles = distanceMiles({ lat: Number(t.lat), lng: Number(t.lng) }, { lat: dLat, lng: dLng });
        etaMinutes = Math.max(1, Math.round((miles / AVG_MPH) * 60));
      }
      currentDelivery = {
        id: cur.delivery.id,
        orderNumber: cur.orderNumber ?? null,
        customer: cur.customerName ?? null,
        address: formatAddress(cur.delivery.address),
        lat: dLat,
        lng: dLng,
        sequence: cur.delivery.sequence ?? null,
        status: cur.delivery.status,
        etaMinutes,
      };
    }

    return {
      vehicle: {
        id: v.id,
        name: v.name,
        make: v.make ?? null,
        model: v.model ?? null,
        licensePlate: v.licensePlate ?? null,
        baseLat: toNum(v.lat),
        baseLng: toNum(v.lng),
      },
      telemetry: t
        ? {
            lat: Number(t.lat),
            lng: Number(t.lng),
            speedMph: Number(t.speedMph),
            headingDeg: t.headingDeg,
            status: t.status as TelemetryStatus,
            updatedAt: datetime(t.updatedAt),
          }
        : null,
      driver,
      currentDelivery,
      stats: { deliveredToday, remainingToday, totalToday: forVehicle.length },
    };
  });

  const stops = todays
    .map((d) => {
      const lat = toNum(d.delivery.lat);
      const lng = toNum(d.delivery.lng);
      if (lat == null || lng == null) return null;
      return {
        id: d.delivery.id,
        orderNumber: d.orderNumber ?? null,
        customer: d.customerName ?? null,
        address: formatAddress(d.delivery.address),
        lat,
        lng,
        status: d.delivery.status,
        sequence: d.delivery.sequence ?? null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null);

  // Group today's stops into each driver's ordered run (for the route lines).
  const routeMap = new Map<string, FleetTelemetry["routes"][number]>();
  for (const d of todays) {
    const lat = toNum(d.delivery.lat);
    const lng = toNum(d.delivery.lng);
    if (lat == null || lng == null || !d.driverId) continue;
    let r = routeMap.get(d.driverId);
    if (!r) {
      r = {
        driverId: d.driverId,
        driverName: d.driverName ?? "",
        vehicleId: d.delivery.vehicleId ?? null,
        stops: [],
      };
      routeMap.set(d.driverId, r);
    }
    r.stops.push({
      id: d.delivery.id,
      lat,
      lng,
      sequence: d.delivery.sequence ?? null,
      status: d.delivery.status,
      customer: d.customerName ?? null,
      orderNumber: d.orderNumber ?? null,
      address: formatAddress(d.delivery.address),
    });
  }
  const routes = Array.from(routeMap.values()).map((r) => ({
    ...r,
    stops: r.stops.sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999)),
  }));

  const fleet = {
    enRoute: vehiclesOut.filter((v) => v.telemetry?.status === "EN_ROUTE").length,
    idle: vehiclesOut.filter((v) => !v.telemetry || v.telemetry.status === "IDLE").length,
    returning: vehiclesOut.filter((v) => v.telemetry?.status === "RETURNING").length,
    stopsRemaining: stops.filter(
      (s) => s.status === "OUT_FOR_DELIVERY" || s.status === "ASSIGNED",
    ).length,
  };

  return { depot: AUSTIN_DEPOT, bounds: AUSTIN_BOUNDS, vehicles: vehiclesOut, stops, routes, fleet };
}

/** Latest ping per vehicle, keyed by vehicleId (raw rows; used internally). */
export async function getTelemetryByVehicle(ctx: ServiceCtx): Promise<Map<string, TelemetryRow>> {
  const rows = await db
    .select()
    .from(vehicleTelemetry)
    .where(eq(vehicleTelemetry.organizationId, ctx.orgId));
  return new Map(rows.map((r) => [r.vehicleId, r]));
}

// ---- Write -------------------------------------------------------------------

/**
 * Upsert the last-known ping for a vehicle (one row per vehicle, replaced in
 * place). Optionally also append a row to the `telemetry_pings` history trail.
 */
export async function upsertTelemetry(ctx: ServiceCtx, input: TelemetryInput): Promise<TelemetryRow> {
  const { lat, lng } = clamp(input.lat, input.lng);
  const latS = lat.toFixed(6);
  const lngS = lng.toFixed(6);
  const speed = (input.speedMph ?? 0).toFixed(2);
  const heading = Math.round(input.headingDeg ?? 0) % 360;
  const status = input.status ?? "IDLE";
  const now = new Date();

  const [row] = await db
    .insert(vehicleTelemetry)
    .values({
      organizationId: ctx.orgId,
      vehicleId: input.vehicleId,
      lat: latS,
      lng: lngS,
      speedMph: speed,
      headingDeg: heading,
      status,
      currentDeliveryId: input.currentDeliveryId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [vehicleTelemetry.organizationId, vehicleTelemetry.vehicleId],
      set: {
        lat: latS,
        lng: lngS,
        speedMph: speed,
        headingDeg: heading,
        status,
        currentDeliveryId: input.currentDeliveryId ?? null,
        updatedAt: now,
      },
    })
    .returning();

  if (input.recordPing) {
    await db.insert(telemetryPings).values({
      organizationId: ctx.orgId,
      vehicleId: input.vehicleId,
      lat: latS,
      lng: lngS,
      speedMph: speed,
      headingDeg: heading,
      recordedAt: now,
    });
  }
  return row;
}

// Fraction of the remaining distance to close each tick, and the arrival radius.
const STEP_FRACTION = 0.4;
const ARRIVAL_MILES = 0.25;

export type SimulateResult = {
  moved: number;
  arrived: number;
  vehicles: {
    vehicleId: string;
    status: TelemetryStatus;
    lat: number;
    lng: number;
    arrivedDeliveryId?: string;
  }[];
};

/**
 * Advance the persisted snapshot one deterministic step: each EN_ROUTE vehicle
 * moves a fixed fraction of the remaining distance toward its current stop's
 * coords (heading + speed recomputed from the leg). On arrival it marks that
 * delivery DELIVERED, then either targets its next pending stop (staying
 * EN_ROUTE) or, if none remain, turns RETURNING toward the depot; once back at
 * the depot it goes IDLE. Deterministic - no randomness - so repeated calls walk
 * the fleet through the day. Records a ping per moved vehicle.
 */
export async function simulateTelemetryTick(ctx: ServiceCtx): Promise<SimulateResult> {
  const telemetry = await db
    .select()
    .from(vehicleTelemetry)
    .where(eq(vehicleTelemetry.organizationId, ctx.orgId));

  const { start, end } = todayWindow();
  const todays = await db
    .select()
    .from(deliveries)
    .where(
      and(
        eq(deliveries.organizationId, ctx.orgId),
        gte(deliveries.scheduledAt, start),
        lt(deliveries.scheduledAt, end),
      ),
    )
    .orderBy(asc(deliveries.sequence), asc(deliveries.createdAt));

  const result: SimulateResult = { moved: 0, arrived: 0, vehicles: [] };

  for (const t of telemetry) {
    const status = t.status as TelemetryStatus;
    if (status === "IDLE" || status === "STOPPED") continue;

    const here: LatLng = { lat: Number(t.lat), lng: Number(t.lng) };

    // Resolve the target: current stop (EN_ROUTE) or the depot (RETURNING).
    let target: LatLng | null = null;
    const targetDelivery = t.currentDeliveryId
      ? todays.find((d) => d.id === t.currentDeliveryId)
      : undefined;
    if (status === "EN_ROUTE" && targetDelivery && targetDelivery.lat && targetDelivery.lng) {
      target = { lat: Number(targetDelivery.lat), lng: Number(targetDelivery.lng) };
    } else if (status === "RETURNING") {
      target = AUSTIN_DEPOT;
    }
    if (!target) continue;

    const remaining = distanceMiles(here, target);

    // Arrived.
    if (remaining <= ARRIVAL_MILES) {
      if (status === "EN_ROUTE" && targetDelivery) {
        await advanceDeliveryStatus(ctx, targetDelivery.id, "DELIVERED");
        result.arrived++;
      }
      // Pick the next pending stop for this vehicle (skip the one just delivered).
      const next = todays.find(
        (d) =>
          d.vehicleId === t.vehicleId &&
          d.id !== targetDelivery?.id &&
          d.lat != null &&
          d.lng != null &&
          (d.status === "ASSIGNED" || d.status === "OUT_FOR_DELIVERY"),
      );
      if (next) {
        if (next.status === "ASSIGNED") await advanceDeliveryStatus(ctx, next.id, "OUT_FOR_DELIVERY");
        const nextTarget = { lat: Number(next.lat), lng: Number(next.lng) };
        const row = await upsertTelemetry(ctx, {
          vehicleId: t.vehicleId,
          lat: target.lat,
          lng: target.lng,
          speedMph: 18,
          headingDeg: bearingDeg(target, nextTarget),
          status: "EN_ROUTE",
          currentDeliveryId: next.id,
          recordPing: true,
        });
        result.vehicles.push({
          vehicleId: t.vehicleId,
          status: "EN_ROUTE",
          lat: Number(row.lat),
          lng: Number(row.lng),
          arrivedDeliveryId: targetDelivery?.id,
        });
      } else if (status === "EN_ROUTE") {
        // No more stops - head home.
        const row = await upsertTelemetry(ctx, {
          vehicleId: t.vehicleId,
          lat: target.lat,
          lng: target.lng,
          speedMph: 20,
          headingDeg: bearingDeg(target, AUSTIN_DEPOT),
          status: "RETURNING",
          currentDeliveryId: null,
          recordPing: true,
        });
        result.vehicles.push({ vehicleId: t.vehicleId, status: "RETURNING", lat: Number(row.lat), lng: Number(row.lng), arrivedDeliveryId: targetDelivery?.id });
      } else {
        // Back at the depot.
        const row = await upsertTelemetry(ctx, {
          vehicleId: t.vehicleId,
          lat: AUSTIN_DEPOT.lat,
          lng: AUSTIN_DEPOT.lng,
          speedMph: 0,
          headingDeg: t.headingDeg,
          status: "IDLE",
          currentDeliveryId: null,
          recordPing: true,
        });
        result.vehicles.push({ vehicleId: t.vehicleId, status: "IDLE", lat: Number(row.lat), lng: Number(row.lng) });
      }
      result.moved++;
      continue;
    }

    // Step toward the target.
    const next: LatLng = {
      lat: here.lat + (target.lat - here.lat) * STEP_FRACTION,
      lng: here.lng + (target.lng - here.lng) * STEP_FRACTION,
    };
    const row = await upsertTelemetry(ctx, {
      vehicleId: t.vehicleId,
      lat: next.lat,
      lng: next.lng,
      speedMph: status === "RETURNING" ? 24 : 18,
      headingDeg: bearingDeg(here, target),
      status,
      currentDeliveryId: t.currentDeliveryId,
      recordPing: true,
    });
    result.moved++;
    result.vehicles.push({ vehicleId: t.vehicleId, status, lat: Number(row.lat), lng: Number(row.lng) });
  }

  return result;
}

// ---- Helpers -----------------------------------------------------------------

/** [midnight today, midnight tomorrow) in the server's local day. */
function todayWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Collapse an address snapshot into a one-line label. */
function formatAddress(address: unknown): string | null {
  if (!address || typeof address !== "object") return null;
  const a = address as Address & Record<string, string | null | undefined>;
  const parts = [a.line1, a.line2, a.city, a.state, a.postal_code].filter(
    (p): p is string => !!p && String(p).trim().length > 0,
  );
  return parts.length ? parts.join(", ") : null;
}

/** Distru-faithful serialization of one vehicle's telemetry for the public API. */
export function fleetVehicleToApi(v: FleetVehicleTelemetry) {
  return {
    vehicle: {
      id: v.vehicle.id,
      name: v.vehicle.name,
      make: v.vehicle.make,
      model: v.vehicle.model,
      license_plate: v.vehicle.licensePlate,
    },
    driver: v.driver ? { id: v.driver.id, name: v.driver.name } : null,
    status: v.telemetry?.status ?? "IDLE",
    location: v.telemetry ? { lat: v.telemetry.lat, lng: v.telemetry.lng } : null,
    speed_mph: v.telemetry?.speedMph ?? null,
    heading_deg: v.telemetry?.headingDeg ?? null,
    updated_datetime: v.telemetry?.updatedAt ?? null,
    current_delivery: v.currentDelivery
      ? {
          id: v.currentDelivery.id,
          order_number: v.currentDelivery.orderNumber,
          customer: v.currentDelivery.customer,
          address: v.currentDelivery.address,
          location:
            v.currentDelivery.lat != null && v.currentDelivery.lng != null
              ? { lat: v.currentDelivery.lat, lng: v.currentDelivery.lng }
              : null,
          sequence: v.currentDelivery.sequence,
          status: v.currentDelivery.status,
          eta_minutes: v.currentDelivery.etaMinutes,
        }
      : null,
    stops_delivered_today: v.stats.deliveredToday,
    stops_remaining_today: v.stats.remainingToday,
    stops_total_today: v.stats.totalToday,
  };
}

/** The full fleet snapshot serialized for the public API. */
export function fleetTelemetryToApi(f: FleetTelemetry) {
  return {
    depot: f.depot,
    bounds: f.bounds,
    fleet: {
      en_route: f.fleet.enRoute,
      idle: f.fleet.idle,
      returning: f.fleet.returning,
      stops_remaining: f.fleet.stopsRemaining,
    },
    vehicles: f.vehicles.map(fleetVehicleToApi),
  };
}
