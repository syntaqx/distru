import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
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

/** A grouping of companies (e.g. a parent org or account tier). */
export const companyGroups = pgTable(
  "company_groups",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("company_groups_org_name_uq").on(t.organizationId, t.name)],
);

/**
 * Companies are the CRM entities that act as a product's Vendor/Brand and as a
 * sales Customer. `roles` is a text[] of VENDOR | BRAND | CUSTOMER.
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
    groupId: uuid("group_id").references(() => companyGroups.id, { onDelete: "set null" }),
    tags: text().array().notNull().default([]),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    ...timestamps(),
  },
  (t) => [uniqueIndex("companies_org_name_uq").on(t.organizationId, t.name)],
);

/** A person/contact at a company (buyer, AP clerk, license holder, ...). */
export const contacts = pgTable(
  "contacts",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    name: text().notNull(),
    email: text(),
    phone: text(),
    title: text(),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    ...timestamps(),
  },
  (t) => [index("contacts_org_company_idx").on(t.organizationId, t.companyId)],
);

/**
 * CRM sales notes / activity log entries pinned to a company. Org-scoped and
 * attributed to the actor who wrote them (`authorId` mirrors the audit log's
 * text actor id so system/agent/user authors all fit). These render newest-first
 * on the company detail timeline alongside that company's recent orders/invoices.
 */
export const companyNotes = pgTable(
  "company_notes",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    // Text (not a uuid FK) so "system"/"agent" actors serialize like the audit log.
    authorId: text("author_id"),
    body: text().notNull(),
    ...timestamps(),
  },
  (t) => [index("company_notes_org_company_idx").on(t.organizationId, t.companyId)],
);

export const locations = pgTable(
  "locations",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    // Physical address + coordinates. Coordinates make a location mappable; the
    // one flagged `isDepot` is the fleet's home base that the dispatch map centers
    // on and that every delivery run departs from and returns to.
    address: text(),
    lat: numeric({ precision: 10, scale: 6 }),
    lng: numeric({ precision: 10, scale: 6 }),
    isDepot: boolean("is_depot").notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex("locations_org_name_uq").on(t.organizationId, t.name)],
);

/** Catalog depth: sub-classifications, brand/strain, POS + compliance mappings. */
export const productSubcategories = pgTable(
  "product_subcategories",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [uniqueIndex("product_subcategories_org_name_uq").on(t.organizationId, t.name)],
);

export const productGroups = pgTable(
  "product_groups",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("product_groups_org_name_uq").on(t.organizationId, t.name)],
);

export const strains = pgTable(
  "strains",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    // INDICA | SATIVA | HYBRID | CBD | NONE - kept as text to avoid over-modeling.
    type: text(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("strains_org_name_uq").on(t.organizationId, t.name)],
);

/** Distru's fixed compliance taxonomy (BioTrack/Metrc official categories). */
export const officialProductCategories = pgTable("official_product_categories", {
  id: pk(),
  name: text().notNull().unique(),
});

/** A free-form tag, reusable across catalog entities. */
export const tags = pgTable(
  "tags",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("tags_org_name_uq").on(t.organizationId, t.name)],
);

export const taxes = pgTable(
  "taxes",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    rate: numeric({ precision: 9, scale: 6 }).notNull().default("0"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("taxes_org_name_uq").on(t.organizationId, t.name)],
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
    // Pricing: wholesale unit price + retail MSRP.
    unitPrice: numeric({ precision: 18, scale: 6 }),
    msrp: numeric({ precision: 18, scale: 6 }),
    // Standard unit cost - the default COGS basis used when receiving stock
    // without an explicit purchase cost (Distru's `unit_cost`).
    unitCost: numeric("unit_cost", { precision: 18, scale: 6 }),
    // Scannable barcode/UPC for the product (distinct from the SKU).
    barcode: text(),
    netQuantityPerUnit: numeric({ precision: 18, scale: 6 }),
    servingUnitTypeId: uuid().references(() => unitTypes.id, {
      onDelete: "set null",
    }),
    servingSize: numeric({ precision: 18, scale: 6 }),
    // Identity / classification depth.
    upc: text(),
    brandId: uuid("brand_id").references(() => companies.id, { onDelete: "set null" }),
    strainId: uuid("strain_id").references(() => strains.id, { onDelete: "set null" }),
    subcategoryId: uuid("subcategory_id").references(() => productSubcategories.id, { onDelete: "set null" }),
    productGroupId: uuid("product_group_id").references(() => productGroups.id, { onDelete: "set null" }),
    // Cannabis potency (percent), and behavior flags.
    thcContent: numeric("thc_content", { precision: 9, scale: 4 }),
    cbdContent: numeric("cbd_content", { precision: 9, scale: 4 }),
    isInventoryItem: boolean("is_inventory_item").notNull().default(true),
    isSample: boolean("is_sample").notNull().default(false),
    taxable: boolean().notNull().default(true),
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

/**
 * Product images. Stored as data URLs (self-contained, no object store needed
 * for the clone); a real deployment would swap dataUrl for a CDN URL. One image
 * per row, ordered, with a primary flag for the list/detail thumbnail.
 */
export const productImages = pgTable(
  "product_images",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    dataUrl: text("data_url").notNull(),
    position: integer().notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);
