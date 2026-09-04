import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { locations, products } from "./catalog";
import { pk } from "./_shared";

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
