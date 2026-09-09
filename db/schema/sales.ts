import { boolean, index, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { companies, locations, products } from "./catalog";
import { chargeKind, invoiceStatus, orderStatus, pk, returnStatus, timestamps } from "./_shared";

/**
 * Sales orders + invoicing - the revenue side of the catalog. An order is a set
 * of line items sold to a customer (a CRM company); confirming it decrements the
 * inventory ledger, and an invoice is a billable snapshot of an order.
 */
export const orders = pgTable(
  "orders",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderNumber: text().notNull(),
    customerId: uuid().references(() => companies.id, { onDelete: "set null" }),
    locationId: uuid().references(() => locations.id, { onDelete: "set null" }),
    status: orderStatus().notNull().default("PENDING"),
    orderDate: timestamp({ withTimezone: true }).notNull().defaultNow(),
    notes: text(),
    billingAddress: jsonb("billing_address"),
    shippingAddress: jsonb("shipping_address"),
    tags: text().array().notNull().default([]),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("orders_org_number_uq").on(t.organizationId, t.orderNumber),
    index("orders_org_status_idx").on(t.organizationId, t.status),
  ],
);

/**
 * A line-level charge on an order beyond the item subtotal: a fee, shipping,
 * a tax line, or a discount. FEE/SHIPPING/TAX add to the total; DISCOUNT
 * subtracts. Mirrors Distru's order `charges` collection.
 */
export const orderCharges = pgTable(
  "order_charges",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: chargeKind().notNull().default("FEE"),
    amount: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_charges_order_idx").on(t.orderId)],
);

/**
 * A single line on an order. `sku`/`name` are snapshots so the order still reads
 * correctly if the product is later renamed or archived; `productId` keeps the
 * link for inventory movements.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    sku: text(),
    name: text().notNull(),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    unitPrice: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    invoiceNumber: text().notNull(),
    orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid().references(() => companies.id, { onDelete: "set null" }),
    status: invoiceStatus().notNull().default("NOT_PAID"),
    voided: boolean().notNull().default(false),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    issueDate: timestamp({ withTimezone: true }).notNull().defaultNow(),
    dueDate: timestamp({ withTimezone: true }),
    // Financial breakdown, snapshotted from the order at issue time.
    subtotal: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    chargeTotal: numeric("charge_total", { precision: 18, scale: 6 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 18, scale: 6 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 18, scale: 6 }).notNull().default("0"),
    total: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    amountPaid: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    creditsApplied: numeric("credits_applied", { precision: 18, scale: 6 }).notNull().default("0"),
    notes: text(),
    billingAddress: jsonb("billing_address"),
    tags: text().array().notNull().default([]),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("invoices_org_number_uq").on(t.organizationId, t.invoiceNumber),
    index("invoices_org_status_idx").on(t.organizationId, t.status),
  ],
);

/**
 * A customer return - goods coming back from a sale. Receiving a return restocks
 * the inventory ledger (the mirror of an order's decrement). Optionally linked to
 * the original order it reverses.
 */
export const returns = pgTable(
  "returns",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    returnNumber: text().notNull(),
    orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid().references(() => companies.id, { onDelete: "set null" }),
    locationId: uuid().references(() => locations.id, { onDelete: "set null" }),
    status: returnStatus().notNull().default("DRAFT"),
    reason: text(),
    returnDate: timestamp({ withTimezone: true }).notNull().defaultNow(),
    notes: text(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("returns_org_number_uq").on(t.organizationId, t.returnNumber),
    index("returns_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const returnItems = pgTable(
  "return_items",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    returnId: uuid()
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
    sku: text(),
    name: text().notNull(),
    quantity: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    unitPrice: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("return_items_return_idx").on(t.returnId)],
);

// ---------------- Sales reference / configuration resources ----------------

/** How a payment is made (Cash, Check, ACH, Wire, ...) - reference data. */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("payment_methods_org_name_uq").on(t.organizationId, t.name)],
);

/** Net-terms an invoice's due date derives from (Net 30, Due on receipt, ...). */
export const paymentTerms = pgTable(
  "payment_terms",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    netDays: numeric("net_days", { precision: 6, scale: 0 }).notNull().default("0"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("payment_terms_org_name_uq").on(t.organizationId, t.name)],
);

/** A named pricing tier a customer can be assigned to (Wholesale, Retail, ...). */
export const priceTiers = pgTable(
  "price_tiers",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("price_tiers_org_name_uq").on(t.organizationId, t.name)],
);

/** A reusable charge template (a standard fee/discount) applied to orders. */
export const chargePresets = pgTable(
  "charge_presets",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: chargeKind().notNull().default("FEE"),
    amount: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("charge_presets_org_name_uq").on(t.organizationId, t.name)],
);

/** A published sales menu (a shareable subset of the catalog with tier pricing). */
export const menus = pgTable(
  "menus",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    priceTierId: uuid("price_tier_id").references(() => priceTiers.id, { onDelete: "set null" }),
    published: text().notNull().default("DRAFT"), // DRAFT | PUBLISHED
    ...timestamps(),
  },
  (t) => [uniqueIndex("menus_org_name_uq").on(t.organizationId, t.name)],
);

/** A customer credit (goodwill/return credit) that can offset invoice balances. */
export const credits = pgTable(
  "credits",
  {
    id: pk(),
    organizationId: uuid().notNull().references(() => organization.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => companies.id, { onDelete: "set null" }),
    amount: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    remaining: numeric({ precision: 18, scale: 6 }).notNull().default("0"),
    reason: text(),
    ...timestamps(),
  },
  (t) => [index("credits_org_customer_idx").on(t.organizationId, t.customerId)],
);

export const payments = pgTable(
  "payments",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: numeric({ precision: 18, scale: 6 }).notNull(),
    method: text().notNull().default("cash"),
    reference: text(),
    paidAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId)],
);
