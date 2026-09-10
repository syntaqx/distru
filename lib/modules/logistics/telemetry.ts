import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  deliveries,
  deliveryRoutes,
  drivers,
  locations,
  orders,
  vehicles,
} from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { datetime } from "../shared";
import type { Address } from "../sales";
import type { DeliveryStatus } from "./deliveries";
import { pointAtFraction, polylineMeters } from "./route-geometry";
import { getRunGeometryPersisted } from "./route-cache";
import type { RouteResult } from "@/lib/integrations";

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

const toNum = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

type LatLng = { lat: number; lng: number };

// ---- Types -------------------------------------------------------------------

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
  depot: LatLng & { name: string | null; address: string | null };
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
   *
   * `geometry` is the real street path through the run (depot -> stops -> depot)
   * from the routing provider, or null when routing is unavailable (the map then
   * draws straight lines). `legs` splits that path per stop so the map can
   * animate each vehicle down the exact street segment toward its current stop:
   * `toDeliveryId` is the delivery a leg arrives at (null on the return-to-depot
   * leg, used to animate a RETURNING vehicle).
   */
  routes: {
    driverId: string;
    driverName: string;
    vehicleId: string | null;
    geometry: [number, number][] | null;
    legs: { toDeliveryId: string | null; geometry: [number, number][] }[];
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

/**
 * The full dispatch snapshot: every vehicle with its latest telemetry, the
 * delivery it's currently running (with destination coords + a distance-based
 * ETA), its driver, and per-vehicle + fleet-wide counts. Also returns today's
 * geocoded stops so the map can plot them. This is what both the Dispatch UI and
 * the public telemetry endpoint render.
 */
export async function getFleetTelemetry(ctx: ServiceCtx): Promise<FleetTelemetry> {
  const now = Date.now();
  const depot = await getDepot(ctx);

  const vehicleRows = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.organizationId, ctx.orgId))
    .orderBy(asc(vehicles.name));

  // Today's deliveries, joined to their run's schedule (departure/complete times).
  const { start, end } = todayWindow();
  const todays = await db
    .select({
      delivery: deliveries,
      orderNumber: orders.orderNumber,
      customerName: companies.name,
      driverId: drivers.id,
      driverName: drivers.name,
      departureAt: deliveryRoutes.departureAt,
      completeAt: deliveryRoutes.completeAt,
    })
    .from(deliveries)
    .leftJoin(orders, eq(deliveries.orderId, orders.id))
    .leftJoin(companies, eq(orders.customerId, companies.id))
    .leftJoin(drivers, eq(deliveries.driverId, drivers.id))
    .leftJoin(deliveryRoutes, eq(deliveries.routeId, deliveryRoutes.id))
    .where(
      and(
        eq(deliveries.organizationId, ctx.orgId),
        gte(deliveries.scheduledAt, start),
        lt(deliveries.scheduledAt, end),
      ),
    )
    .orderBy(asc(deliveries.sequence), asc(deliveries.createdAt));

  // Group today's deliveries into each driver's ordered run.
  type RunRow = (typeof todays)[number];
  const runMap = new Map<string, RunRow[]>();
  for (const d of todays) {
    if (!d.driverId || toNum(d.delivery.lat) == null || toNum(d.delivery.lng) == null) continue;
    (runMap.get(d.driverId) ?? runMap.set(d.driverId, []).get(d.driverId)!).push(d);
  }

  // For every run: fetch its cached street geometry, then derive live state from
  // the wall clock against the run's schedule (position on the road, status, ETA,
  // and which stops have been dropped) - so the day simply progresses in real time.
  type Computed = {
    driverId: string;
    driverName: string;
    vehicleId: string | null;
    orderedStops: RunRow[];
    geometry: [number, number][] | null;
    legs: { toDeliveryId: string | null; geometry: [number, number][] }[];
    sim: RunSim;
  };
  const computed: Computed[] = await Promise.all(
    Array.from(runMap.entries()).map(async ([driverId, rows]) => {
      const ordered = [...rows].sort(
        (a, b) => (a.delivery.sequence ?? 999) - (b.delivery.sequence ?? 999),
      );
      const stops = ordered.map((d) => ({ id: d.delivery.id, lat: Number(d.delivery.lat), lng: Number(d.delivery.lng) }));
      const { route, legDeliveryIds } = await getRunGeometryPersisted(ctx, depot, stops);
      const legs =
        route?.legs.map((leg, i) => ({ toDeliveryId: legDeliveryIds[i] ?? null, geometry: leg.geometry as [number, number][] })) ?? [];
      const sim = simulateRun(depot, stops, route, ordered[0].departureAt, ordered[0].completeAt, now);
      return {
        driverId,
        driverName: ordered[0].driverName ?? "",
        vehicleId: ordered[0].delivery.vehicleId ?? null,
        orderedStops: ordered,
        geometry: (route?.geometry ?? null) as [number, number][] | null,
        legs,
        sim,
      };
    }),
  );

  // Computed status per delivery (time-derived), and reconcile the DB toward it so
  // the deliveries board + reports reflect the day - recording real drop times.
  const statusById = new Map<string, string>();
  const computedByVehicle = new Map<string, Computed>();
  const reconcile: { id: string; status: DeliveryStatus; deliveredAt: Date | null }[] = [];
  for (const c of computed) {
    if (c.vehicleId) computedByVehicle.set(c.vehicleId, c);
    for (const d of c.orderedStops) {
      const st = c.sim.stopStatus.get(d.delivery.id) ?? "ASSIGNED";
      statusById.set(d.delivery.id, st);
      const dropped = c.sim.deliveredAt.get(d.delivery.id) ?? null;
      if (d.delivery.status !== st || (st === "DELIVERED" && !d.delivery.deliveredAt)) {
        reconcile.push({ id: d.delivery.id, status: st as DeliveryStatus, deliveredAt: dropped });
      }
    }
  }
  for (const r of reconcile) {
    await db
      .update(deliveries)
      .set({ status: r.status, ...(r.deliveredAt ? { deliveredAt: r.deliveredAt } : {}), updatedAt: new Date() })
      .where(and(eq(deliveries.organizationId, ctx.orgId), eq(deliveries.id, r.id)));
  }

  // ---- Build the snapshot from the computed state --------------------------
  const custOf = (d: RunRow) => d.customerName ?? addressName(d.delivery.address);

  const vehiclesOut: FleetVehicleTelemetry[] = vehicleRows.map((v) => {
    const c = computedByVehicle.get(v.id);
    if (!c) {
      // A vehicle with no run today - parked at the depot.
      return {
        vehicle: { id: v.id, name: v.name, make: v.make ?? null, model: v.model ?? null, licensePlate: v.licensePlate ?? null, baseLat: toNum(v.lat), baseLng: toNum(v.lng) },
        telemetry: { lat: depot.lat, lng: depot.lng, speedMph: 0, headingDeg: 0, status: "IDLE", updatedAt: datetime(new Date(now)) },
        driver: null,
        currentDelivery: null,
        stats: { deliveredToday: 0, remainingToday: 0, totalToday: 0 },
      };
    }
    const delivered = c.orderedStops.filter((d) => statusById.get(d.delivery.id) === "DELIVERED").length;
    const total = c.orderedStops.length;
    const curRow = c.sim.currentDeliveryId ? c.orderedStops.find((d) => d.delivery.id === c.sim.currentDeliveryId) : undefined;
    const p = c.sim.position;
    return {
      vehicle: { id: v.id, name: v.name, make: v.make ?? null, model: v.model ?? null, licensePlate: v.licensePlate ?? null, baseLat: toNum(v.lat), baseLng: toNum(v.lng) },
      telemetry: { lat: p.lat, lng: p.lng, speedMph: p.speedMph, headingDeg: p.heading, status: c.sim.status, updatedAt: datetime(new Date(now)) },
      driver: { id: c.driverId, name: c.driverName },
      currentDelivery: curRow
        ? {
            id: curRow.delivery.id,
            orderNumber: curRow.orderNumber ?? null,
            customer: custOf(curRow),
            address: formatAddress(curRow.delivery.address),
            lat: toNum(curRow.delivery.lat),
            lng: toNum(curRow.delivery.lng),
            sequence: curRow.delivery.sequence ?? null,
            status: statusById.get(curRow.delivery.id) ?? "ASSIGNED",
            etaMinutes: c.sim.etaMinutes,
          }
        : null,
      stats: { deliveredToday: delivered, remainingToday: total - delivered, totalToday: total },
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
        customer: custOf(d),
        address: formatAddress(d.delivery.address),
        lat,
        lng,
        status: statusById.get(d.delivery.id) ?? d.delivery.status,
        sequence: d.delivery.sequence ?? null,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null);

  const routes = computed.map((c) => ({
    driverId: c.driverId,
    driverName: c.driverName,
    vehicleId: c.vehicleId,
    geometry: c.geometry,
    legs: c.legs,
    stops: c.orderedStops.map((d) => ({
      id: d.delivery.id,
      lat: Number(d.delivery.lat),
      lng: Number(d.delivery.lng),
      sequence: d.delivery.sequence ?? null,
      status: statusById.get(d.delivery.id) ?? d.delivery.status,
      customer: custOf(d),
      orderNumber: d.orderNumber ?? null,
      address: formatAddress(d.delivery.address),
    })),
  }));

  const fleet = {
    enRoute: vehiclesOut.filter((v) => v.telemetry?.status === "EN_ROUTE").length,
    idle: vehiclesOut.filter((v) => !v.telemetry || v.telemetry.status === "IDLE").length,
    returning: vehiclesOut.filter((v) => v.telemetry?.status === "RETURNING").length,
    stopsRemaining: stops.filter((s) => s.status === "OUT_FOR_DELIVERY" || s.status === "ASSIGNED").length,
  };

  return { depot, bounds: AUSTIN_BOUNDS, vehicles: vehiclesOut, stops, routes, fleet };
}

// ---- Real-time run simulation (position/status derived from the clock) -------

type RunSim = {
  position: { lat: number; lng: number; heading: number; speedMph: number };
  status: TelemetryStatus;
  currentDeliveryId: string | null;
  etaMinutes: number | null;
  stopStatus: Map<string, string>;
  deliveredAt: Map<string, Date>;
};

/**
 * Derive a run's live state at time `now` from its schedule window
 * [departureAt, completeAt]: the day is divided into equal slots (one per stop
 * plus a return), each stop is driven then dwelt-at, and the vehicle's position
 * is interpolated along the real street leg for the phase it's in. Deterministic
 * in `now`, so the fleet simply plays out the operating day in real time.
 */
function simulateRun(
  depot: { lat: number; lng: number },
  stops: { id: string; lat: number; lng: number }[],
  route: RouteResult | null,
  departureAt: Date | null,
  completeAt: Date | null,
  now: number,
): RunSim {
  const n = stops.length;
  const stopStatus = new Map<string, string>();
  const deliveredAt = new Map<string, Date>();
  const atDepot = { lat: depot.lat, lng: depot.lng, heading: 0, speedMph: 0 };
  const legGeom = (i: number): [number, number][] | null => route?.legs?.[i]?.geometry ?? null;

  if (!departureAt || !completeAt || n === 0) {
    for (const s of stops) stopStatus.set(s.id, "ASSIGNED");
    return { position: atDepot, status: "IDLE", currentDeliveryId: stops[0]?.id ?? null, etaMinutes: null, stopStatus, deliveredAt };
  }

  const D = departureAt.getTime();
  const C = completeAt.getTime();
  const slot = Math.max(C - D, 60_000) / (n + 1); // n stops + a return leg
  const dwell = Math.min(slot * 0.35, 12 * 60_000);
  const drop: number[] = [];
  const arrive: number[] = [];
  const driveStart: number[] = [];
  for (let i = 0; i < n; i++) {
    drop[i] = D + (i + 1) * slot;
    arrive[i] = drop[i] - dwell;
    driveStart[i] = i === 0 ? D : drop[i - 1];
  }
  const returnEnd = C;

  for (let i = 0; i < n; i++) {
    if (drop[i] <= now) {
      stopStatus.set(stops[i].id, "DELIVERED");
      deliveredAt.set(stops[i].id, new Date(drop[i]));
    } else {
      stopStatus.set(stops[i].id, "ASSIGNED");
    }
  }

  const speedFor = (g: [number, number][] | null, ms: number) => {
    if (!g || g.length < 2 || ms <= 0) return 20;
    const mph = (polylineMeters(g) / (ms / 1000)) * 2.23694;
    return Math.round(Math.min(55, Math.max(6, mph)));
  };

  // Before departure: staged at the depot; after return: parked again.
  if (now < D) return { position: atDepot, status: "IDLE", currentDeliveryId: stops[0].id, etaMinutes: null, stopStatus, deliveredAt };
  if (now >= returnEnd) return { position: atDepot, status: "IDLE", currentDeliveryId: null, etaMinutes: null, stopStatus, deliveredAt };

  for (let i = 0; i < n; i++) {
    if (now >= driveStart[i] && now < arrive[i]) {
      const g = legGeom(i);
      const frac = (now - driveStart[i]) / Math.max(arrive[i] - driveStart[i], 1);
      const p = g && g.length >= 2 ? pointAtFraction(g, frac) : { lat: stops[i].lat, lng: stops[i].lng, heading: 0 };
      stopStatus.set(stops[i].id, "OUT_FOR_DELIVERY");
      return { position: { ...p, speedMph: speedFor(g, arrive[i] - driveStart[i]) }, status: "EN_ROUTE", currentDeliveryId: stops[i].id, etaMinutes: Math.max(1, Math.round((arrive[i] - now) / 60_000)), stopStatus, deliveredAt };
    }
    if (now >= arrive[i] && now < drop[i]) {
      stopStatus.set(stops[i].id, "OUT_FOR_DELIVERY");
      return { position: { lat: stops[i].lat, lng: stops[i].lng, heading: 0, speedMph: 0 }, status: "STOPPED", currentDeliveryId: stops[i].id, etaMinutes: 0, stopStatus, deliveredAt };
    }
  }

  // Past the last drop, before the day closes: driving home.
  const g = legGeom(n);
  const frac = (now - drop[n - 1]) / Math.max(returnEnd - drop[n - 1], 1);
  const p = g && g.length >= 2 ? pointAtFraction(g, frac) : atDepot;
  return { position: { lat: p.lat, lng: p.lng, heading: "heading" in p ? p.heading : 0, speedMph: 24 }, status: "RETURNING", currentDeliveryId: null, etaMinutes: null, stopStatus, deliveredAt };
}

/**
 * The dispatch depot: the org's designated depot location (a `locations` row with
 * coordinates + `is_depot`), else any location with coordinates, else the Austin
 * fallback. This is where the depot is *configured* - edit that location's
 * coordinates and the map, routing, and every run's start/end move with it.
 */
async function getDepot(ctx: ServiceCtx): Promise<FleetTelemetry["depot"]> {
  const rows = await db
    .select({ name: locations.name, lat: locations.lat, lng: locations.lng, address: locations.address, isDepot: locations.isDepot })
    .from(locations)
    .where(eq(locations.organizationId, ctx.orgId));
  const withCoords = rows.filter((r) => r.lat != null && r.lng != null);
  const chosen = withCoords.find((r) => r.isDepot) ?? withCoords[0];
  if (chosen) {
    return { lat: Number(chosen.lat), lng: Number(chosen.lng), name: chosen.name, address: chosen.address ?? null };
  }
  return { lat: AUSTIN_DEPOT.lat, lng: AUSTIN_DEPOT.lng, name: "Austin Depot", address: null };
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

/**
 * The business name captured on a delivery's address snapshot, if any. Order-free
 * deliveries (bulk-seeded dispatch runs) carry the customer name here since
 * there's no order→company to join; a real order-backed delivery leaves it unset
 * and the joined company name wins.
 */
function addressName(address: unknown): string | null {
  if (!address || typeof address !== "object") return null;
  const n = (address as Record<string, unknown>).name;
  return typeof n === "string" && n.trim() ? n.trim() : null;
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
