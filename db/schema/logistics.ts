import { pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
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
    name: text().notNull(),
    phone: text(),
    licenseNumber: text("license_number"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("drivers_org_name_uq").on(t.organizationId, t.name)],
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
    ...timestamps(),
  },
  (t) => [uniqueIndex("vehicles_org_name_uq").on(t.organizationId, t.name)],
);
