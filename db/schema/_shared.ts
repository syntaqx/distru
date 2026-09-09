import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

/**
 * UUIDv7 primary key - time-sortable UUIDs everywhere. Generated in the app
 * layer so the same generator backs both Drizzle inserts and better-auth
 * (which is configured with `generateId: () => uuidv7()`).
 */
export const pk = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

/** Standard created/updated timestamps. Spread into a table definition. */
export const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---- Domain enums (uppercase, mirroring Distru's API conventions) ----
export const inventoryTrackingMethod = pgEnum("inventory_tracking_method", [
  "PACKAGE",
  "PRODUCT",
  "BATCH",
]);

export const productStatus = pgEnum("product_status", ["ACTIVE", "ARCHIVED"]);

export const measurementKind = pgEnum("measurement_kind", [
  "WEIGHT",
  "VOLUME",
  "COUNT",
]);

export const importStatus = pgEnum("import_status", [
  "UPLOADED",
  "MAPPING",
  "VALIDATING",
  "READY",
  "COMMITTING",
  "PARTIAL",
  "DONE",
  "FAILED",
]);

export const importRowStatus = pgEnum("import_row_status", [
  "PENDING",
  "VALID",
  "WARNING",
  "ERROR",
  "COMMITTED",
  "SKIPPED",
]);

// Sales order fulfillment lifecycle, matching Distru's real statuses. PENDING
// holds no stock; committing to PROCESSING decrements inventory and it stays
// committed through delivery/completion; CANCELED restores it.
export const orderStatus = pgEnum("order_status", [
  "PENDING",
  "PROCESSING",
  "READY_TO_SHIP",
  "DELIVERING",
  "DELIVERED",
  "COMPLETED",
  "CANCELED",
]);

// Invoice PAYMENT status, matching Distru. Voiding is a separate boolean flag
// (an invoice can be voided in any payment state), not a status value.
export const invoiceStatus = pgEnum("invoice_status", [
  "NOT_PAID",
  "PARTIALLY_PAID",
  "FULLY_PAID",
  "OVER_PAID",
]);

// Purchase orders (buying from a vendor) move DRAFT → OPEN → RECEIVED (which
// INCREMENTS stock); CANCELLED reverses any stock a received PO added. A
// simplified slice of Distru's real purchasing lifecycle.
export const purchaseOrderStatus = pgEnum("purchase_order_status", [
  "DRAFT",
  "OPEN",
  "RECEIVED",
  "CANCELED",
]);

// Customer returns: DRAFT → RECEIVED (which restocks inventory); CANCELED
// reverses a received return's restock.
export const returnStatus = pgEnum("return_status", [
  "DRAFT",
  "RECEIVED",
  "CANCELED",
]);

// Order/invoice line-level adjustments beyond the item subtotal. FEE, SHIPPING
// and TAX add to the total; DISCOUNT subtracts. Mirrors Distru's `charges`
// collection on orders and invoices.
export const chargeKind = pgEnum("charge_kind", [
  "FEE",
  "DISCOUNT",
  "SHIPPING",
  "TAX",
]);
