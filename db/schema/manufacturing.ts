import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    completionDatetime: timestamp("completion_datetime", { withTimezone: true }),
    notes: text(),
    customFields: jsonb("custom_fields").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [uniqueIndex("assemblies_org_number_uq").on(t.organizationId, t.assemblyNumber)],
);

/** An input consumed by an assembly (raw/intermediate product + quantity). */
export const assemblyInputs = pgTable(
  "assembly_inputs",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    assemblyId: uuid("assembly_id").notNull().references(() => assemblies.id, { onDelete: "cascade" }),
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assembly_outputs_assembly_idx").on(t.assemblyId)],
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
