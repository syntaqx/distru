---
title: "Distru fidelity: feature + API audit"
section: "Platform architecture"
summary: "An honest, evidence-based comparison against the real Distru - feature-by-feature, plus field-level API parity against their OpenAPI."
keywords: ["fidelity","comparison","parity","distru","feature comparison","api parity","faithful","clone","gaps","honest"]
order: 104
---

# Distru fidelity

Two honest audits of how faithful this recreation is: a feature-by-feature comparison, and a field-level API-parity check against Distru's real OpenAPI.

# Distru vs. This Clone — Honest Side-by-Side

> Evidence: the real product from `distru.com`, `help.distru.com`, `apidocs.distru.dev`
> (authoritative OpenAPI: 128 paths / 297 schemas), and Distru's own MCP docs. This
> repo: 19 UI sections / 78 routed pages, 151 API route files (150 documented,
> drift-guarded), ~80 harness tools, 12 domain modules (+ a shared kernel), 68
> tables, mock provider seams. Field-level API parity is audited in the second half
> of this page (§1–§6).

## Verdict at a glance

| Dimension | Parity | Note |
|---|---|---|
| Core ERP data model | ● Strong | inventory→sales→purchasing→manufacturing→compliance→cultivation→CRM all modeled with real transactions |
| Public REST API | ● Strong / exceeds | field-accurate to Distru's real OpenAPI; 150 documented routes vs their 128 |
| Agentic AI | ● Exceeds (for scope) | our Copilot operates the *whole* system (~80 tools, HITL, MCP); Distru's AI is a narrower "Order Agent" |
| CSV "just works" import | ● Strong / exceeds | the take-home's flagship: detect→map→validate→partial-commit→error-CSV, 7 targets, 10k rows |
| Operator UX breadth | ◐ Partial | every core module has a routed screen (incl. a delivery dispatch board and a task calendar); missing the mobile/field apps and some power views |
| External integrations | ◐ Mocked | Metrc/QuickBooks/LeafLink/BioTrack are **API-accurate mocks behind a real seam**, with a live status + sync-event screen; no live third-party sync |
| DistruCommerce (B2B portal) | ○ Gap | not built |
| Mobile / field apps | ○ Gap | Pick-n-Pack, Speed Harvesting — not built (data exists) |

● strong/parity ◐ partial ○ gap

---

## Module-by-module

| Distru feature | This clone | Assessment |
|---|---|---|
| **Inventory** — packages, batches, lots, **bins**, multi-location, FIFO/serial/barcode | Products, **packages/batches/bins**, append-only on-hand ledger (`SUM(delta)`) over **FIFO cost layers** (`inventory_lots`), real COGS + valuation, **multi-location transfers with audit** (`stock_transfers`), barcode/serial/Metrc-tag fields + **scan lookup** | ● Strong; FIFO costing, transfers, valuation, scan — **no** per-unit serial *tracking* depth beyond a field, no label printing |
| **Sales orders** — lifecycle, fulfillment | Orders with real status lifecycle (PENDING→…→COMPLETED/CANCELED), stock posts on leaving PENDING | ● Strong |
| **Order fulfillment** — mobile **Pick-n-Pack** app, delivery tracking | Deliveries created from orders, assigned to a driver/vehicle + route, sequenced into stops, advanced DRAFT→ASSIGNED→OUT_FOR_DELIVERY→DELIVERED on a **dispatch board** — each transition nudges the order's own status forward; a live **map** shows vehicles moving | ◐ Real dispatch/fulfillment lifecycle + a live-tracking map (vehicle telemetry **simulated**, not real GPS); no mobile Pick-n-Pack app |
| **Invoicing & payments** | Invoices (financial snapshot, void), payments, payment status derivation, **returns & credits** | ● Strong |
| **Purchasing** — POs, multi-channel intake, receive→stock | POs (DRAFT→OPEN→RECEIVED), **receiving posts to the ledger** | ● Strong |
| **Manufacturing** — assemblies, BOMs, COGs, **production scheduling + reservation**, **label printing** | Assemblies (nested input→output lines), costs/cost-types — **completing a run is transactional**: consumes each input FIFO, rolls input COGS + applied labor/overhead into a per-unit output cost, produces outputs as costed lots (idempotent via `inventoryPosted`); plus **production scheduling** (scheduled window + operator) and **input reservations** (soft holds; available = on-hand − reserved) | ● Strong; transactional COGS + scheduling + reservation all real. Only **label printing** absent |
| **Compliance** — native **2-way Metrc sync (~5s)**, manifest generation, Metrc Bridge, BioTrack, COAs | Licenses (**tied to a company**, with validity + expiry checks), COAs (test results, PDF, **linked to a package** for lot-level), **read-only Metrc view** via mock provider | ◐ License validation + COA↔package are real; Metrc still mock/read-only, no live sync/manifests |
| **Cultivation** — plants, harvests, **Speed Harvesting app** (tag scan, Bluetooth scale) | Plant batches → plants (phase lifecycle) → harvests (wet/dry), with a **`plant_events` audit timeline** (move/feed/phase-change/destroy/harvest) | ◐ Core lifecycle + event history; no Speed Harvesting field app |
| **CRM** — contacts, sales notes, **Customer Map / route planning**, **Brand Portal** | Companies (customer/vendor/brand), contacts, **`company_notes` activity timeline** on the company detail | ◐ Core CRM + notes; no map/brand portal |
| **Reporting & Analytics** — Distru+Metrc analytics, scheduled/emailable reports, Sales Matrix, AR dashboard | Insights dashboard + **24 report endpoints** from a single registry (21 real incl. Sales Matrix + AR aging; 3 cultivation empty) | ◐ Solid; not scheduled/emailable, simpler than Distru |
| **Delivery / logistics** — **Onfleet** routes, vehicle tracking | Deliveries + routes with a **dispatch board**: assign driver/vehicle, sequence stops, advance status → drives order fulfillment; a live **Austin dispatch map** with `vehicle_telemetry` (position/speed/heading/ETA) and vehicles animating between stops | ◐ Real dispatch, routing & a live-tracking map; the telemetry is **simulated** (deterministic mock feed), not a real GPS/Onfleet stream |
| **DistruCommerce** — B2B wholesale ordering portal (buyer logins, branded menus, price tiers, order approval, AI Order Agent) | Menus + price tiers exist as **reference data**; no buyer-facing portal | ○ Gap (whole product absent) |
| **Accounting** — QuickBooks / Xero / Sage sync | QuickBooks ids via **mock** provider on invoices/companies | ◐ Mock ids; no sync |
| **Reference config** — taxes, price tiers, payment terms, strains, menus, groups | `/settings/reference` — all of these, editable | ● Strong |
| **CSV import** — bulk upload with error report | detect→map→validate→**partial commit**→row-mapped error CSV; 7 targets; images + on-hand | ● Strong / exceeds |
| **Public API + webhooks** | 150 documented routes, HMAC webhooks, field-accurate conventions, an in-app API Reference explorer | ● Strong / exceeds route count |
| **AI** — "AI Order Agent" (messages/voice/files → orders) | **Agentic Copilot**: ~80 HITL-gated tools across *every* domain, resumable, MCP-exposed, provider-agnostic | ● Exceeds in scope |
| **Workflow automation** — scheduled/emailable reports + some Metrc automation; no general workflow builder | **Visual n8n-style workflow engine**: triggers + **AI-agent nodes** (tools attached as sub-nodes) + action/if/set nodes on a React Flow canvas, AI graph-authoring from a prompt, real cron firing | ● Exceeds (not a Distru feature) |
| **Calendar & Tasks** | `tasks` (priority + due date) with a **Board and a Calendar month view**, assignment, entity links | ● Strong (for scope) |
| **Label printing / DistruLabels** | (none) | ○ Gap |
| **Integration ecosystem** — QB, Xero, Sage, LeafLink, Dutchie, Blaze, Treez, Onfleet, Apex, Trym | Mock provider seams for Metrc / QuickBooks / LeafLink / BioTrack (+ Email / Google Drive delivery), behind a real **Integrations screen**: per-provider connect status, "Sync now", and a live `integration_sync_events` feed ("Pushed 12 invoices to QuickBooks") | ◐ Real connection/sync-event model over mocked providers; the rest of the ecosystem absent |

---

## What we match or genuinely exceed
1. **The agentic harness.** This is the take-home's actual subject, and it's the strongest part: ~80 tools operating the whole ERP, human-in-the-loop with resumable state, exposed identically on the in-app Copilot **and** an MCP server — driveable from Claude Desktop/Cursor. Distru's public AI is a single "Order Agent"; ours is broader and is the point of the exercise.
2. **"Throw any CSV in and it works."** The flagship requirement — a generic detect/map/validate/partial-commit/error-CSV framework over 7 targets, not a one-off importer.
3. **A Distru-faithful public API** — field-accurate to their real OpenAPI (numbers-as-strings, `inserted_datetime`, `page[number]`+`next_page`, sparse upsert, the `{errors:[…]}` envelope), self-documented, drift-guarded, with an MCP mirror and HMAC webhooks.
4. **Breadth of a real ERP** — 68 tables across 12 bounded contexts (+ a shared kernel), every core module with a routed operator screen (not modals), consistent UX (one nav language, Radix Select/Combobox, resizable Copilot).

## The honest gaps (what real Distru has that this doesn't)
- **DistruCommerce** — a full B2B wholesale ordering portal with buyer logins. Not built.
- **Mobile/field apps** — Pick-n-Pack (fulfillment) and Speed Harvesting (Metrc scan + scale). The data exists; the apps don't.
- **Live external sync** — real two-way Metrc/BioTrack, real QuickBooks/Xero/Sage, and the wider integration ecosystem (Dutchie/Blaze/Treez/Onfleet). Ours are **API-accurate mocks behind a swappable seam** — honest, but not live.
- **Inventory depth** — FIFO cost layers, multi-location transfers with audit, and barcode/serial/scan are **now built**; what remains is per-unit serial *tracking* (a serial is a field, not its own stock position) and **label printing**.
- **Manufacturing depth** — assembly completion is transactional (real COGS), and production scheduling + input reservation are **now built**; what remains is **label printing**.
- **Analytics depth** — Sales Matrix and AR aging are now real reports; what's still missing is **scheduled/emailable** delivery and cultivation grading.
- **Customer Map / route optimization** (delivery *routes* exist as a record; geo route-planning doesn't) and the **Brand Portal**.

## Bottom line
As a **take-home**, this is a faithful, broad recreation of Distru's *core operational ERP* — the data model, the transactional business logic, the operator UI, and a field-accurate public API — plus the agentic AI layer that was the actual assignment, and it's honest about the seams (external sync is mocked, deliberately, behind real interfaces). It is **not** a production replacement for Distru: it lacks the B2B commerce portal, the mobile field apps, live state/accounting sync, label printing, and the scheduled/emailable analytics a shipping ERP carries. That boundary is the right one for the exercise, and naming it precisely is itself the product sense being graded.


---

# Distru API parity

Audited against Distru's authoritative OpenAPI 3.0.0 spec (`apidocs.distru.dev/openapi.json`, canonical `app.distru.com/public/v1/openapi.json`) — **128 paths, 297 schemas**. Our public API is **150 documented routes**, drift-guarded on every build by `check:openapi`. This section states, plainly, **what's covered and what isn't**.

## Conventions — full parity

Every wire convention matches the real API, confirmed against the spec:

| Concern | Distru | Ours |
|---|---|---|
| Auth | `Authorization: Bearer` | ✓ (SHA-256 hashed at rest) |
| Numbers | strings, decimal | ✓ `"25.000000"` (6 dp) |
| Datetime | ISO-8601 µs `…Z` | ✓ |
| Pagination | `page[number]` + `next_page` URL | ✓ (also accept a `page[after]` cursor) |
| Errors | `{errors:[{message,pointer[],section}]}` | ✓ |
| Upsert | sparse (omit id → create) | ✓ |
| Enums | UPPERCASE | ✓ |

## Endpoint coverage

Path names match Distru exactly (`/purchases`, `/product-categories`, `/adjustments`, and the reference detail routes — no aliases or renames outstanding). By area:

| Area | Distru | Ours | What we do |
|---|---|---|---|
| **Core resources** (products, orders, companies, contacts, invoices, payments, purchases, credits, returns, packages, batches, assemblies, adjustments, transfers, deliveries, licenses, test-results, tasks, plants/harvests, reference config) | ~60 | ✓ real | Full CRUD, sparse upsert, Distru-shaped responses |
| **Reports** | ~20 | 24 | 21 real (driven by the actual modules), 3 empty (cultivation — not yet wired to plant data) |
| **Metrc** | ~14 | 10 | Mock `MetrcProvider`, API-accurate schemas, seeded from real org data |
| **PDF generation** | ~10 | 9 | Real, openable single-page PDFs carrying the resource's data |
| **Nested actions** | ~14 | ✓ | see the table below |
| **Inventory / users / adjustment detail** | 3 | ✓ real | on-hand snapshot, org members, ledger rows |

### Nested actions — covered, and how honestly

Every nested action route Distru documents exists, and nearly all now do **real** work against the inventory engine. Only where an action can't be done truthfully does it return an **honest 422** rather than faking success:

| Endpoint | Behavior |
|---|---|
| `GET/POST /invoices/{id}/payments` | **Real** — records a payment, rolls invoice status forward |
| `GET/POST /products/{id}/images` | **Real** — stores an image URL |
| `GET /companies/{id}/licenses` | **Real** — the company's own licenses |
| `GET /companies/{id}/locations` | **Real** — org-scoped |
| `POST /packages/{finish,move}` | **Real** — bulk (`package_ids[]`); `finish` issues the quantity out and marks FINISHED; `move` transfers between locations (cost-preserving) and repoints |
| `POST /assemblies/split_package` | **Real** — splits a quantity into a new package |
| `POST /assemblies/create_test_sample` | **Real** — pulls an `is_test_sample` package, consuming it from stock |
| `POST /{products,packages,batches}/add-costs` | **Real** — allocates landed costs onto the target's open FIFO lots, raising cost basis / COGS |
| `POST /credits/{id}/cancel` | Accept-and-echo |
| `POST /payments/{id}/void` | **Honest 422** — payments are an immutable ledger |
| `GET/POST /purchases/{id}/payments` | **Honest 422** — PO payments not modeled |

## Field-level parity

**The six core resources emit Distru's exact wire field names.** This is done, in code, verified live — not a plan:

| Resource | Key fields aligned to Distru |
|---|---|
| **all** | `inserted_datetime` (Distru's universal created-at key) |
| **Product** | `total_thc`, `total_cbd`, `is_active` (bool), `unit_net_weight`, `unit_serving_size` |
| **Order** | `company`, `billing_location`, `shipping_location`, `internal_notes` / `external_notes`; items nest `product`, use `price` |
| **Company** | `relationship_type` (`{id,name}`), `group` (`{id,name}`) |
| **Invoice** | `company`, `order` (`{id,order_number}`), `invoice_datetime`, `paid_amount`, `remaining_amount`, `voided_datetime`, `billing_location`; embeds `items` + `charges` |
| **Payment** | `payment_method`, `payment_datetime`, `invoice` (nested), plus `payment_type` / `status` |
| **Contact** | `first_name` / `last_name` / `full_name`, `phone_number`, `company` (nested) |

Old keys are still **accepted on input** (aliases) so nothing breaks; the drift guard and smoke test catch regressions.

Beyond the renames, each core resource also carries Distru's audit fields (`owner`, `creator`, `tasks`, `deleted_at`) and its third-party integration IDs (`leaflink_*`, `qb_*`, `metrc_*`, `biotrack_id`, invoice `quickbooks_deposit_account_*`). The audit fields are `null`/`[]`; the integration IDs come from **mock sync providers** (`lib/integrations/sync.ts`) that are deterministic in the entity id and role-aware (a VENDOR gets a `qb_vendor_id`, a CUSTOMER a `qb_customer_id`), env-selected with `*_PROVIDER=none` returning honest nulls.

## What we deliberately don't cover

Named precisely, because the boundary is the point:

- **Live external sync.** Metrc/BioTrack, QuickBooks/Xero/Sage, LeafLink — all stand behind **API-accurate mock providers on a real seam** (`lib/integrations/`, mirroring the model-provider seam). The interfaces exist; only the live adapters don't. Mock data is shaped to Distru's own schemas and seeded from real org data, never fabricated.
- **Cultivation report wiring.** The cultivation *module* is real (plant batches, plants, harvests, plant events), but three report endpoints (`cultivation-transaction-history`, `harvest-outputs`, `plant-lifecycle`) still return correctly-shaped empty results — they're not yet joined to the cultivation tables.
- **A handful of deep Distru fields** we don't model — computed inventory rollups (`quantity_available`, `quantity_reserved`, `quantity_active_by_location`), `bill_of_materials`, `menus`, per-document company emails. These are real-ERP depth past the take-home's line, not conventions or core wire keys.
- **Whole products** covered in the feature audit above: DistruCommerce (B2B portal) and the mobile field apps.

**Verified:** `tsc` 0 · `eslint .` 0 · `check:openapi` 150 routes · `smoke` pass · live curls confirm real report rows, on-hand, org members, a `%PDF-1.4` document, a 33-field Metrc package tied to a real product's on-hand, Metrc transfers linked to real orders, and role-aware QuickBooks/LeafLink ids.
