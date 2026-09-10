import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { companies, products } from "./catalog";
import { packages } from "./inventory";
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
    // A license may belong to a company (a customer/vendor's license) or to the
    // org itself (companyId null = our own operating license).
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    name: text(),
    state: text(),
    // Distru exposes `active` (boolean) + `issue_datetime` alongside expiry.
    active: boolean().notNull().default(true),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("licenses_org_number_uq").on(t.organizationId, t.licenseNumber),
    index("licenses_company_idx").on(t.organizationId, t.companyId),
  ],
);

/** A lab test result / certificate of analysis for a product (or Metrc package). */
export const testResults = pgTable(
  "test_results",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    // A COA can be tied directly to the package it tested (lot-level traceability)
    // in addition to the product.
    packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
    metrcLabTestId: text("metrc_lab_test_id"),
    name: text(),
    coaUrl: text("coa_url"),
    // Structured potency (Distru's PrimaryTestResult), in addition to the free
    // `results` blob: percentages and per-unit mg for THC/CBD.
    thcPercentage: numeric("thc_percentage", { precision: 10, scale: 4 }),
    cbdPercentage: numeric("cbd_percentage", { precision: 10, scale: 4 }),
    thcMgPerUnit: numeric("thc_mg_per_unit", { precision: 10, scale: 4 }),
    cbdMgPerUnit: numeric("cbd_mg_per_unit", { precision: 10, scale: 4 }),
    testedAt: timestamp("tested_at", { withTimezone: true }),
    passed: text(), // PASS | FAIL | PENDING (kept as text to avoid over-modeling)
    results: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [
    index("test_results_org_product_idx").on(t.organizationId, t.productId),
    index("test_results_package_idx").on(t.organizationId, t.packageId),
  ],
);
