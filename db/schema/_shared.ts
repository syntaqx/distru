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
