import { integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { locations, strains } from "./catalog";
import { pk, timestamps, plantPhase, harvestStatus } from "./_shared";

/**
 * Cultivation context - the grow side of seed-to-sale, mirroring Distru/Metrc:
 * plant batches (groups of immature plants) mature into individual plants, which
 * are harvested into harvest batches that eventually become packages. Org-scoped
 * like every other domain; strain/location reference the catalog.
 */

/** A group of immature plants (clones/seeds) of one strain, planted together. */
export const plantBatches = pgTable(
  "plant_batches",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    batchNumber: text("batch_number").notNull(),
    strainId: uuid("strain_id").references(() => strains.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    count: integer().notNull().default(0),
    phase: plantPhase().notNull().default("IMMATURE"),
    sourceType: text("source_type"), // Clone | Seed
    plantedDate: timestamp("planted_date", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("plant_batches_org_number_uq").on(t.organizationId, t.batchNumber)],
);

/** An individual tracked plant, usually promoted out of a plant batch. */
export const plants = pgTable(
  "plants",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    plantTag: text("plant_tag").notNull(),
    strainId: uuid("strain_id").references(() => strains.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    plantBatchId: uuid("plant_batch_id").references(() => plantBatches.id, { onDelete: "set null" }),
    phase: plantPhase().notNull().default("VEGETATIVE"),
    plantedDate: timestamp("planted_date", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("plants_org_tag_uq").on(t.organizationId, t.plantTag)],
);

/** A harvest batch: plants cut and drying/curing, weighed wet then dry. */
export const harvests = pgTable(
  "harvests",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    harvestNumber: text("harvest_number").notNull(),
    name: text(),
    strainId: uuid("strain_id").references(() => strains.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    plantCount: integer("plant_count").notNull().default(0),
    wetWeight: numeric("wet_weight", { precision: 18, scale: 6 }),
    dryWeight: numeric("dry_weight", { precision: 18, scale: 6 }),
    status: harvestStatus().notNull().default("ACTIVE"),
    harvestedDate: timestamp("harvested_date", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("harvests_org_number_uq").on(t.organizationId, t.harvestNumber)],
);
