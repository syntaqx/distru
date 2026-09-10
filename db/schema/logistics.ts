import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { orders } from "./sales";
import { pk, timestamps } from "./_shared";

/**
 * Logistics context - the people and equipment that fulfill deliveries. Distru's
 * drivers/vehicles, referenced by an order's delivery once routing is wired
 * (delivery assignment is a documented follow-up).
 */
export const drivers = pgTable(
  "drivers",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    // A driver is a real person who signs into the driver mobile app, so a driver
    // links to a better-auth `user` (login identity). Null for a contractor
    // driver with no account yet. Deliveries/routes/telemetry keep referencing
    // drivers.id, so this link never changes the shape of the delivery API.
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text().notNull(),
    phone: text(),
    licenseNumber: text("license_number"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("drivers_org_name_uq").on(t.organizationId, t.name),
    // At most one driver profile per person per org (NULLs are distinct in PG,
    // so multiple account-less contractor drivers are still allowed).
    uniqueIndex("drivers_org_user_uq").on(t.organizationId, t.userId),
  ],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    make: text(),
    model: text(),
    licensePlate: text("license_plate"),
    // Home base / depot coordinates this vehicle dispatches from and returns to.
    // Numeric so lat/lng survive the DB round-trip at street precision (~0.1m).
    lat: numeric({ precision: 10, scale: 6 }),
    lng: numeric({ precision: 10, scale: 6 }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("vehicles_org_name_uq").on(t.organizationId, t.name)],
);

/**
 * Delivery fulfillment lifecycle (Distru's Onfleet-style dispatch):
 *  - DRAFT: created from an order, not yet assigned to a driver.
 *  - ASSIGNED: a driver (+ vehicle) is on the hook; scheduled for a day.
 *  - OUT_FOR_DELIVERY: the driver is en route (nudges the order to DELIVERING).
 *  - DELIVERED: dropped off (nudges the order to DELIVERED).
 *  - FAILED: attempted and could not be completed (customer closed, refused, ...).
 */
export const deliveryStatus = pgEnum("delivery_status", [
  "DRAFT",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
]);

/**
 * A named route: one driver's run of stops on a given day. Deliveries point at a
 * route via `routeId`; the route groups and orders them (the driver's manifest).
 */
export const deliveryRoutes = pgTable(
  "delivery_routes",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "set null" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    routeDate: date("route_date"),
    // Real-time run schedule: when the driver leaves the depot and when the whole
    // run (all drops + return) is planned to finish. The dispatch map derives each
    // vehicle's live position, status, and drop times from the current wall-clock
    // time against this window - so the day progresses on its own, in real time.
    departureAt: timestamp("departure_at", { withTimezone: true }),
    completeAt: timestamp("complete_at", { withTimezone: true }),
    notes: text(),
    ...timestamps(),
  },
  (t) => [index("delivery_routes_org_date_idx").on(t.organizationId, t.routeDate)],
);

/**
 * A single delivery (one order's drop-off). Org-scoped, references the sales
 * order it fulfills, and carries its own assignment (driver/vehicle), schedule,
 * an address snapshot taken at creation, a stop sequence within its route, and a
 * status that drives the order's fulfillment lifecycle forward as it advances.
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    routeId: uuid("route_id").references(() => deliveryRoutes.id, { onDelete: "set null" }),
    driverId: uuid("driver_id").references(() => drivers.id, { onDelete: "set null" }),
    vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
    status: deliveryStatus().notNull().default("DRAFT"),
    // Address captured from the order at creation, so a later order edit never
    // rewrites where a driver was actually sent. Stored verbatim as JSONB.
    address: jsonb().$type<Record<string, string | null | undefined>>(),
    // Destination coordinates (the drop-off), used to plot the stop on the
    // dispatch map and to drive vehicle telemetry toward it. Geocoded from the
    // address snapshot at creation; numeric for street-level precision.
    lat: numeric({ precision: 10, scale: 6 }),
    lng: numeric({ precision: 10, scale: 6 }),
    // Stop number within the driver's route/day (1-based); null until sequenced.
    sequence: integer(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    index("deliveries_org_status_idx").on(t.organizationId, t.status),
    index("deliveries_driver_idx").on(t.driverId),
    index("deliveries_order_idx").on(t.orderId),
  ],
);

/**
 * Persistent cache of road geometry from the routing provider, keyed by a hash of
 * the ordered waypoints (depot -> stops -> depot). A dispatch day has stable stop
 * sequences, so each run's real-street path is fetched once and reused by every
 * telemetry read and simulate tick - and, crucially, warmed at seed time - so a
 * fleet of dozens of trucks never triggers a burst of live directions calls on a
 * page load. Org-scoped (coords are the key, but scoping keeps tenants isolated).
 */
export const routeGeometryCache = pgTable(
  "route_geometry_cache",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Hash of the rounded waypoint list; unique per org.
    cacheKey: text("cache_key").notNull(),
    // The provider's RouteResult: { geometry: [lng,lat][], legs: [{geometry,...}] }.
    result: jsonb().$type<unknown>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("route_geometry_cache_org_key_uq").on(t.organizationId, t.cacheKey)],
);

