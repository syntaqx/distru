import { type AnyPgColumn, boolean, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { locations, products } from "./catalog";
import { pk, timestamps } from "./_shared";

/**
 * Manufacturing context - assemblies (production runs that consume input
 * inventory and yield output products) plus the cost model. Distru's Make
 * module. Schema is modeled in full; the run-execution behavior (posting the
 * input/output inventory movements) is marked as a follow-up, so these read and
 * upsert today without yet moving the ledger.
 */
export const assemblyStatus = pgEnum("assembly_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
]);

export const assemblies = pgTable(
  "assemblies",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    assemblyNumber: text("assembly_number").notNull(),
    status: assemblyStatus().notNull().default("PENDING"),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    // --- Production scheduling ---------------------------------------------
    // A planned run carries a scheduled window before it is started. A PENDING
    // assembly with a scheduledStart is a "scheduled" run; the lifecycle stays
    // PENDING -> IN_PROGRESS -> COMPLETED, with scheduling just annotating the
    // plan. `assignedTo` is a free-text operator/crew label (no user FK, so it
    // works for both members and ad-hoc crews).
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    estimatedWorkMinutes: integer("estimated_work_minutes"),
    assignedTo: text("assigned_to"),
    completionDatetime: timestamp("completion_datetime", { withTimezone: true }),
    // Set once the run has posted its inventory movements (inputs consumed,
    // outputs produced). Guards against double-posting on re-save.
    inventoryPosted: boolean("inventory_posted").notNull().default(false),
    notes: text(),
    customFields: jsonb("custom_fields").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("assemblies_org_number_uq").on(t.organizationId, t.assemblyNumber),
    index("assemblies_org_scheduled_idx").on(t.organizationId, t.scheduledStart),
  ],
);

/** An input consumed by an assembly (raw/intermediate product + quantity). */
export const assemblyInputs = pgTable(
  "assembly_inputs",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    assemblyId: uuid("assembly_id").notNull().references(() => assemblies.id, { onDelete: "cascade" }),
    // Distru nests inputs under the output they're consumed for. A null outputId
    // means the input is shared across the run (our original flat model).
    outputId: uuid("output_id").references((): AnyPgColumn => assemblyOutputs.id, {
      onDelete: "cascade",
    }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assembly_inputs_assembly_idx").on(t.assemblyId)],
);

/** An output produced by an assembly (finished product + quantity). */
export const assemblyOutputs = pgTable(
  "assembly_outputs",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    assemblyId: uuid("assembly_id").notNull().references(() => assemblies.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    // Rolled unit cost of the produced output = (input COGS + applied costs) /
    // total output qty, captured when the run posts to inventory.
    unitCost: numeric("unit_cost", { precision: 18, scale: 6 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assembly_outputs_assembly_idx").on(t.assemblyId)],
);

/**
 * A soft hold on input stock for a planned/in-progress (not-yet-posted)
 * assembly, so the same units are not double-committed across runs. Reservations
 * are opened when a run moves to IN_PROGRESS and released when it COMPLETES
 * (real stock is then consumed by the FIFO posting) or is CANCELED. Available
 * stock in the planning UI is `on-hand - SUM(ACTIVE reservations)`.
 */
export const assemblyReservationStatus = pgEnum("assembly_reservation_status", [
  "ACTIVE",
  "RELEASED",
]);

export const assemblyReservations = pgTable(
  "assembly_reservations",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    assemblyId: uuid("assembly_id").notNull().references(() => assemblies.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    status: assemblyReservationStatus().notNull().default("ACTIVE"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (t) => [
    index("assembly_reservations_assembly_idx").on(t.assemblyId),
    // The hot path for reservedByProduct: active holds for a product in the org.
    index("assembly_reservations_org_status_product_idx").on(
      t.organizationId,
      t.status,
      t.productId,
    ),
  ],
);

/** A cost type (labor, overhead, packaging, ...) - reference data. */
export const costTypes = pgTable(
  "cost_types",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("cost_types_org_name_uq").on(t.organizationId, t.name)],
);

/** A cost applied to an assembly (or, in future, a batch), of a given type. */
export const costs = pgTable(
  "costs",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    assemblyId: uuid("assembly_id").references(() => assemblies.id, { onDelete: "cascade" }),
    costTypeId: uuid("cost_type_id").references(() => costTypes.id, { onDelete: "set null" }),
    description: text(),
    amount: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("costs_org_idx").on(t.organizationId)],
);
