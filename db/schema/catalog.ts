import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import {
  inventoryTrackingMethod,
  measurementKind,
  pk,
  productStatus,
  timestamps,
} from "./_shared";

/**
 * Unit types are a global reference set (Gram, Ounce, Unit, ...), mirroring
 * Distru's fixed singular unit-type list. Not org-scoped.
 */
export const unitTypes = pgTable("unit_types", {
  id: pk(),
  name: text().notNull().unique(),
  measurementKind: measurementKind().notNull(),
});

export const categories = pgTable(
  "categories",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    biotrackType: text(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("categories_org_name_uq").on(t.organizationId, t.name)],
);

/**
 * Companies are the CRM entities that act as a product's Vendor/Brand (and, in
 * future, Customer). `roles` is a text[] of VENDOR | BRAND | CUSTOMER.
 */
export const companies = pgTable(
  "companies",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    roles: text().array().notNull().default(["VENDOR"]),
    ...timestamps(),
  },
  (t) => [uniqueIndex("companies_org_name_uq").on(t.organizationId, t.name)],
);

export const locations = pgTable(
  "locations",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("locations_org_name_uq").on(t.organizationId, t.name)],
);

export const products = pgTable(
  "products",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    inventoryTrackingMethod: inventoryTrackingMethod().notNull().default("PACKAGE"),
    name: text().notNull(),
    sku: text().notNull(),
    categoryId: uuid().references(() => categories.id, { onDelete: "set null" }),
    vendorId: uuid().references(() => companies.id, { onDelete: "set null" }),
    unitTypeId: uuid().references(() => unitTypes.id, { onDelete: "set null" }),
    unitPrice: numeric({ precision: 18, scale: 6 }),
    netQuantityPerUnit: numeric({ precision: 18, scale: 6 }),
    servingUnitTypeId: uuid().references(() => unitTypes.id, {
      onDelete: "set null",
    }),
    servingSize: numeric({ precision: 18, scale: 6 }),
    description: text(),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    status: productStatus().notNull().default("ACTIVE"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("products_org_sku_uq").on(t.organizationId, t.sku),
    index("products_org_name_idx").on(t.organizationId, t.name),
  ],
);
