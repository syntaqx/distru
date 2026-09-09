import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { locations, products } from "./catalog";
import { pk, timestamps } from "./_shared";

/**
 * On-hand inventory is an append-only ledger. Current quantity for a product at
 * a location = SUM(quantityDelta). This keeps "affect inventory for real" fully
 * auditable and mirrors how ERPs model stock movements.
 */
export const inventoryLedger = pgTable(
  "inventory_ledger",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locationId: uuid()
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    quantityDelta: numeric({ precision: 18, scale: 6 }).notNull(),
    reason: text().notNull().default("adjustment"),
    // actor that caused the movement: "user:<id>" | "agent" | "api" | "import:<jobId>"
    actor: text().notNull().default("system"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_ledger_product_loc_idx").on(t.productId, t.locationId),
    index("inventory_ledger_org_idx").on(t.organizationId),
  ],
);

/** A storage bin/shelf within a location - the finest-grained stock position. */
export const bins = pgTable(
  "bins",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("bins_org_name_uq").on(t.organizationId, t.name)],
);

/**
 * A Metrc-tracked package: a physical, tagged unit of a product with its own
 * quantity and compliance tag. The lot-level counterpart to the aggregate
 * on-hand ledger. Modeled here; Metrc sync is a documented follow-up.
 */
export const packages = pgTable(
  "packages",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    packageTag: text("package_tag").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    status: text().notNull().default("ACTIVE"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("packages_org_tag_uq").on(t.organizationId, t.packageTag)],
);

/** A production/harvest batch that packages are derived from. */
export const batches = pgTable(
  "batches",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("batches_org_number_uq").on(t.organizationId, t.batchNumber)],
);
