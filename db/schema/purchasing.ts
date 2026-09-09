import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { companies, locations, products } from "./catalog";
import { pk, purchaseOrderStatus, timestamps } from "./_shared";

/**
 * Purchasing - the buy side, mirroring the sell side under sales/. A purchase
 * order is a set of line items bought from a vendor (a CRM company); receiving it
 * INCREMENTS the inventory ledger (the mirror of a sales order's decrement).
 * A new bounded context that owns its own tables - the worked example of the
 * platform growing along the seams the modular architecture already draws.
 */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    poNumber: text().notNull(),
    vendorId: uuid().references(() => companies.id, { onDelete: "set null" }),
    locationId: uuid().references(() => locations.id, { onDelete: "set null" }),
    status: purchaseOrderStatus().notNull().default("DRAFT"),
    orderDate: timestamp({ withTimezone: true }).notNull().defaultNow(),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("purchase_orders_org_number_uq").on(t.organizationId, t.poNumber),
    index("purchase_orders_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const purchaseOrderItems = pgTable(
  "purchase_order_items",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    purchaseOrderId: uuid()
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    sku: text(),
    name: text().notNull(),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    unitCost: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("purchase_order_items_po_idx").on(t.purchaseOrderId)],
);
