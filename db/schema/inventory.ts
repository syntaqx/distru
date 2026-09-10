import {
  type AnyPgColumn,
  boolean,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { locations, products } from "./catalog";
import { pk, timestamps } from "./_shared";

/**
 * On-hand inventory is an append-only ledger. Current quantity for a product at
 * a location = SUM(quantityDelta). This keeps "affect inventory for real" fully
 * auditable and mirrors how ERPs model stock movements.
 *
 * Each movement also carries the cost dimension: `unitCost` is the per-unit cost
 * of that movement, and `lotId` links it to the FIFO cost layer it created (a
 * receipt) or drew down (an issue). Summing `quantityDelta * unitCost` over
 * issues is real COGS; positive movements without a lot predate lot tracking.
 * `refType`/`refId` trace the movement back to what caused it (order, purchase,
 * assembly, transfer) beyond the human-readable `reason`.
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
    unitCost: numeric("unit_cost", { precision: 18, scale: 6 }),
    lotId: uuid("lot_id").references((): AnyPgColumn => inventoryLots.id, {
      onDelete: "set null",
    }),
    binId: uuid("bin_id").references((): AnyPgColumn => bins.id, { onDelete: "set null" }),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    reason: text().notNull().default("adjustment"),
    // actor that caused the movement: "user:<id>" | "agent" | "api" | "import:<jobId>"
    actor: text().notNull().default("system"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_ledger_product_loc_idx").on(t.productId, t.locationId),
    index("inventory_ledger_org_idx").on(t.organizationId),
    index("inventory_ledger_lot_idx").on(t.lotId),
  ],
);

/**
 * A FIFO cost layer: one receipt of stock at a known unit cost. `remainingQty`
 * is drawn down (oldest `receivedAt` first) as stock is issued, so every issue
 * inherits a real per-unit cost and valuation is `SUM(remainingQty * unitCost)`.
 * A lot may be a Metrc-tagged `package` (lot-level traceability) and carries the
 * `sourceType`/`sourceId` of what created it (a purchase receipt, an assembly
 * output, a transfer, an adjustment, an opening balance).
 */
export const inventoryLots = pgTable(
  "inventory_lots",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    binId: uuid("bin_id").references((): AnyPgColumn => bins.id, { onDelete: "set null" }),
    packageId: uuid("package_id").references((): AnyPgColumn => packages.id, {
      onDelete: "set null",
    }),
    lotNumber: text("lot_number").notNull(),
    // PURCHASE | ASSEMBLY | ADJUSTMENT | RETURN | TRANSFER | OPENING | IMPORT
    sourceType: text("source_type").notNull().default("ADJUSTMENT"),
    sourceId: uuid("source_id"),
    unitCost: numeric("unit_cost", { precision: 18, scale: 6 }).notNull().default("0"),
    originalQty: numeric("original_qty", { precision: 18, scale: 6 }).notNull(),
    remainingQty: numeric("remaining_qty", { precision: 18, scale: 6 }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("inventory_lots_fifo_idx").on(
      t.organizationId,
      t.productId,
      t.locationId,
      t.receivedAt,
    ),
    uniqueIndex("inventory_lots_org_number_uq").on(t.organizationId, t.lotNumber),
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
    batchId: uuid("batch_id").references((): AnyPgColumn => batches.id, { onDelete: "set null" }),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    status: text().notNull().default("ACTIVE"),
    // Scan/trace identity: a human barcode + per-unit serial, and the Metrc tag
    // + lab-testing state that tie this package to compliance.
    barcode: text(),
    serialNumber: text("serial_number"),
    metrcTag: text("metrc_tag"),
    labTestingState: text("lab_testing_state"),
    // Distru package classification flags.
    isTestSample: boolean("is_test_sample").notNull().default(false),
    isTradeSample: boolean("is_trade_sample").notNull().default(false),
    isProductionBatch: boolean("is_production_batch").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("packages_org_tag_uq").on(t.organizationId, t.packageTag),
    index("packages_barcode_idx").on(t.organizationId, t.barcode),
  ],
);

/**
 * A stock transfer between two locations - the auditable record of a
 * multi-location move. Completing it FIFO-issues from the source and re-receives
 * into the destination at the same per-lot cost (see `transferStock`).
 */
export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    transferNumber: text("transfer_number").notNull(),
    fromLocationId: uuid("from_location_id").references(() => locations.id, { onDelete: "set null" }),
    toLocationId: uuid("to_location_id").references(() => locations.id, { onDelete: "set null" }),
    status: text().notNull().default("COMPLETED"),
    notes: text(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("stock_transfers_org_number_uq").on(t.organizationId, t.transferNumber)],
);

/** A line on a stock transfer: a product + quantity moved. */
export const stockTransferLines = pgTable(
  "stock_transfer_lines",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    transferId: uuid("transfer_id")
      .notNull()
      .references((): AnyPgColumn => stockTransfers.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    movedCost: numeric("moved_cost", { precision: 18, scale: 6 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_transfer_lines_transfer_idx").on(t.transferId)],
);

/** A production/harvest batch that packages are derived from. */
export const batches = pgTable(
  "batches",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(),
    // Distru's primary batch identifier is `name`; batch_number is secondary.
    name: text(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    thc: numeric({ precision: 10, scale: 4 }),
    cbd: numeric({ precision: 10, scale: 4 }),
    manufacturedAt: timestamp("manufactured_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("batches_org_number_uq").on(t.organizationId, t.batchNumber)],
);
