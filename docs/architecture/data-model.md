---
title: "Data model"
section: "Platform architecture"
summary: "The Postgres schema: org-scoped, UUIDv7, on-hand as a ledger, owned by module."
keywords: ["data model","schema","database","drizzle","postgres","tables","products","inventory","ledger","import","sales","orders","invoices","module ownership"]
order: 103
---
# Data model

Drizzle over Postgres via the `postgres.js` driver. Every domain row carries an `organization_id` and timestamps, ids are UUIDv7, and numbers are stored `numeric` and serialized as strings on the API. The schema is split by **owning module** - `catalog.ts`, `inventory.ts`, `sales.ts`, `purchasing.ts`, `manufacturing.ts`, `compliance.ts`, `cultivation.ts`, `logistics.ts`, `reports.ts`, `platform.ts` (+ `integrations.ts`), `imports.ts`, `notifications.ts` - **68 domain tables** in all, so each bounded context's tables travel with it: the seam a future service would extract along. Two tables carry the model's character.

## Products

A product is one catalog item with a SKU unique per organization.

```ts
export const products = pgTable("products", {
  id: pk(),                          // uuidv7
  organizationId: uuid().notNull().references(() => organization.id),
  inventoryTrackingMethod: enum().notNull().default("PACKAGE"), // PACKAGE|PRODUCT|BATCH
  name: text().notNull(),
  sku: text().notNull(),             // unique per org
  categoryId: uuid().references(() => categories.id),
  vendorId: uuid().references(() => companies.id),
  unitTypeId: uuid().references(() => unitTypes.id),
  unitPrice: numeric({ precision: 18, scale: 6 }),   // wholesale price
  msrp: numeric({ precision: 18, scale: 6 }),        // retail MSRP
  unitCost: numeric({ precision: 18, scale: 6 }),    // standard COGS basis
  barcode: text(),                                   // scannable UPC (distinct from sku)
  thcContent: numeric({ precision: 9, scale: 4 }),   // + cbdContent, strain, brand, subcategory...
  customFields: jsonb().default({}),
  status: enum().default("ACTIVE"),  // ACTIVE|ARCHIVED
  ...timestamps(),
}, (t) => [uniqueIndex("products_org_sku_uq").on(t.organizationId, t.sku)]);
```

## Inventory ledger + FIFO cost layers

On-hand is not a column. It is an append-only ledger of movements, so a product's stock is auditable and nothing is silently overwritten - and each movement now also carries **cost**. A `unitCost` + `lotId` tie a movement to the FIFO cost layer (`inventory_lots`) it opened or drew down, and a `refType`/`refId` pair traces it to the document that caused it (an order, purchase, assembly, or transfer). Valuation is `SUM(remainingQty * unitCost)` over open lots; an issue draws lots oldest-first and inherits their real per-unit cost as COGS. See [The inventory engine](/docs/inventory-engine).

```ts
// on-hand(product, location) = SUM(quantityDelta)
export const inventoryLedger = pgTable("inventory_ledger", {
  id: pk(),
  organizationId: uuid().notNull(),
  productId: uuid().notNull(),
  locationId: uuid().notNull(),
  quantityDelta: numeric({ precision: 18, scale: 6 }).notNull(),
  unitCost: numeric({ precision: 18, scale: 6 }),        // per-unit cost of this movement
  lotId: uuid().references(() => inventoryLots.id),       // FIFO layer opened / drawn down
  binId: uuid().references(() => bins.id),
  refType: text(), refId: uuid(),                         // order | purchase | assembly | transfer
  reason: text().default("adjustment"),
  // "user:<id>" | "agent" | "api" | "import:<jobId>" | "workflow:<id>"
  actor: text().default("system"),
  createdAt: timestamp().defaultNow(),
});
```

## The rest of the model, by module

| Module | Tables | Notes |
|---|---|---|
| Tenancy | `organization`, `member`, `user`, `session`, ... | better-auth org plugin, UUIDv7 |
| catalog | `products`, `product_images`, `categories`, `product_subcategories`, `product_groups`, `strains`, `companies`, `company_groups`, `company_notes`, `contacts`, `locations`, `unit_types`, `tags`, `taxes`, `official_product_categories` | companies carry `roles[]` (VENDOR / BRAND / CUSTOMER), `group_id`, `tags[]`, custom fields; `company_notes` is the CRM activity timeline; contacts are people at a company; unit types are a global fixed set |
| inventory | `inventory_ledger`, `inventory_lots`, `bins`, `packages`, `stock_transfers`, `stock_transfer_lines`, `batches` | on-hand is `SUM(delta)` over the ledger; `inventory_lots` are FIFO cost layers; `packages` carry Metrc trace fields (`metrc_tag`, `barcode`, `serial_number`, `lab_testing_state`, `is_test_sample`/`is_trade_sample`/`is_production_batch`, `batch_id`); transfers move stock cost-preserving between locations |
| sales | `orders`, `order_items`, `order_charges`, `invoices`, `payments`, `returns`, `return_items`, `credits`, `price_tiers`, `payment_methods`, `payment_terms`, `charge_presets`, `menus` | order_items snapshot SKU/name and capture real `cogs` on shipment; `order_charges` are FEE/DISCOUNT/SHIPPING/TAX lines feeding the total; shipping posts FIFO `inventory_ledger` movements; invoices snapshot the order's full financial breakdown; a received return restocks |
| purchasing | `purchase_orders`, `purchase_order_items` | buying from a vendor; receiving a PO opens a FIFO lot at the line's cost - the mirror of a sales decrement |
| manufacturing | `assemblies`, `assembly_inputs`, `assembly_outputs`, `assembly_reservations`, `cost_types`, `costs` | assemblies carry a scheduled window + `assigned_to`; inputs nest under an `output_id`; completing a run consumes inputs FIFO and produces costed output lots (guarded by `inventory_posted`); reservations soft-hold input stock for a planned run |
| compliance | `licenses`, `license_types`, `test_results` | a license links to a `company_id` (validity/expiry checks); a COA (`test_results`) links to a `package_id` and carries structured potency (`thc_percentage`, `cbd_mg_per_unit`, ...) plus `metrc_lab_test_id` |
| cultivation | `plant_batches`, `plants`, `harvests`, `plant_events` | the grow lifecycle: batches mature into tagged plants, which are harvested (wet/dry weight); `plant_events` is the Metrc-style audit timeline |
| logistics | `drivers`, `vehicles`, `delivery_routes`, `deliveries` | a delivery fulfills one order through a DRAFT→ASSIGNED→OUT_FOR_DELIVERY→DELIVERED lifecycle that drives the order forward; routes group a driver's stops for a day |
| reports | `artifacts` | durable, materialized reports produced by the Copilot and workflows (the Insights registry itself is code, not a table) |
| platform | `api_tokens`, `webhook_endpoints`, `webhook_deliveries`, `audit_log`, `custom_fields`, `file_attachments`, `tasks`, `integration_connections`, `integration_sync_events` | tokens SHA-256 hashed; every mutation from every face is audited; `tasks` carry priority + due date; integration rows track per-provider connection status and a live sync-event feed |
| notifications | `notifications` | the feed behind the bell |
| Copilot (Piece 2) | `conversations`, `messages`, `tool_calls`, `workflows`, `workflow_runs` | messages store raw Anthropic content blocks; tool_calls doubles as the agent audit trail; workflows hold the node graph, workflow_runs the per-node results |
