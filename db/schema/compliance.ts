import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { products } from "./catalog";
import { pk, timestamps } from "./_shared";

/**
 * Compliance context - cannabis regulatory surface: state licenses, lab test
 * results (COAs), and the Metrc track-and-trace linkage. Metrc itself is an
 * external system: we model the linkage/fields, and the live sync is a
 * documented follow-up (compliance/README) rather than a fake integration.
 */
export const licenseTypes = pgTable(
  "license_types",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("license_types_org_name_uq").on(t.organizationId, t.name)],
);

export const licenses = pgTable(
  "licenses",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    licenseNumber: text("license_number").notNull(),
    licenseTypeId: uuid("license_type_id").references(() => licenseTypes.id, { onDelete: "set null" }),
    name: text(),
    state: text(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("licenses_org_number_uq").on(t.organizationId, t.licenseNumber)],
);

/** A lab test result / certificate of analysis for a product (or Metrc package). */
export const testResults = pgTable(
  "test_results",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    metrcLabTestId: text("metrc_lab_test_id"),
    testedAt: timestamp("tested_at", { withTimezone: true }),
    passed: text(), // PASS | FAIL | PENDING (kept as text to avoid over-modeling)
    results: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [index("test_results_org_product_idx").on(t.organizationId, t.productId)],
);
