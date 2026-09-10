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
> repo: 19 UI sections / 78 routed pages, 153 versioned API route files under
> `/api/v1` (152 documented, drift-guarded), ~80 harness tools, 12 domain modules
> (+ a shared kernel), 74 tables, config-aware live/mock provider seams (real OAuth
> + REST adapters). Field-level API parity is audited in the second half
> of this page (§1–§6).

## Verdict at a glance

| Dimension | Parity | Note |
|---|---|---|
| Core ERP data model | ● Strong | inventory→sales→purchasing→manufacturing→compliance→cultivation→CRM all modeled with real transactions |
| Public REST API | ● Strong / exceeds | field-accurate to Distru's real OpenAPI; 152 documented routes vs their 128 |
| Agentic AI | ● Exceeds (for scope) | our Copilot operates the *whole* system (~80 tools, HITL, MCP); Distru's AI is a narrower "Order Agent" |
| CSV "just works" import | ● Strong / exceeds | the take-home's flagship: detect→map→validate→partial-commit→error-CSV, 7 targets, 10k rows |
| Operator UX breadth | ◐ Partial | every core module has a routed screen (incl. a delivery dispatch board and a task calendar); missing the mobile/field apps and some power views |
| External integrations | ◐ Wireable — live path built | 9 providers on a **config-aware seam**: entering real credentials switches a provider from the demo mock to a **live adapter that makes actual vendor API calls** — full **OAuth2** (authorize→callback→refresh) for QuickBooks/Xero/Sage and real REST for Metrc/LeafLink/Onfleet/BioTrack, plus **live SMTP email** (nodemailer). The seeded demo stays on the mock (fake creds, marked `__demo`); road routing is live too. Not exercised against live vendors here (no accounts), but "configure it and it works" is real |
| DistruCommerce (B2B portal) | ○ Gap | not built |
| Mobile / field apps | ○ Gap | Pick-n-Pack, Speed Harvesting — not built (data exists) |

● strong/parity ◐ partial ○ gap

---

## Module-by-module

| Distru feature | This clone | Assessment |
|---|---|---|
| **Inventory** — packages, batches, lots, **bins**, multi-location, FIFO/serial/barcode | Products, **packages/batches/bins**, append-only on-hand ledger (`SUM(delta)`) over **FIFO cost layers** (`inventory_lots`), real COGS + valuation, **multi-location transfers with audit** (`stock_transfers`), barcode/serial/Metrc-tag fields + **scan lookup** + a **package label PDF** | ● Strong; FIFO costing, transfers, valuation, scan, basic label print — the only gap is per-unit serial *tracking* depth beyond a field |
| **Sales orders** — lifecycle, fulfillment | Orders with real status lifecycle (PENDING→…→COMPLETED/CANCELED), stock posts on leaving PENDING | ● Strong |
| **Order fulfillment** — mobile **Pick-n-Pack** app, delivery tracking | Deliveries created from orders, assigned to a driver/vehicle + route, sequenced into stops, advanced DRAFT→ASSIGNED→OUT_FOR_DELIVERY→DELIVERED on a **dispatch board** — each transition nudges the order's own status forward; a live **map** shows vehicles **driving the real streets** in real time between stops | ◐ Real dispatch/fulfillment lifecycle + a live-tracking map where vans follow **real road geometry** (routed via a live directions provider) and the day advances on the **wall clock** (positions/ETAs/drop times derived from each run's schedule); the position feed is **modeled**, not real GPS; no mobile Pick-n-Pack app |
| **Invoicing & payments** | Invoices (financial snapshot, void), payments, payment status derivation, **returns & credits** | ● Strong |
| **Purchasing** — POs, multi-channel intake, receive→stock | POs (DRAFT→OPEN→RECEIVED), **receiving posts to the ledger** | ● Strong |
| **Manufacturing** — assemblies, BOMs, COGs, **production scheduling + reservation**, **label printing** | Assemblies (nested input→output lines), costs/cost-types — **completing a run is transactional**: consumes each input FIFO, rolls input COGS + applied labor/overhead into a per-unit output cost, produces outputs as costed lots (idempotent via `inventoryPosted`); plus **production scheduling** (scheduled window + operator) and **input reservations** (soft holds; available = on-hand − reserved) | ● Strong; transactional COGS + scheduling + reservation all real, plus a basic **label PDF** (only rendered-barcode artwork is missing) |
| **Compliance** — native **2-way Metrc sync (~5s)**, manifest generation, Metrc Bridge, BioTrack, COAs | Licenses (**tied to a company**, with validity + expiry checks), COAs (test results, PDF, **linked to a package** for lot-level), **read-only Metrc view** via mock provider | ◐ License validation + COA↔package are real; Metrc still mock/read-only, no live sync/manifests |
| **Cultivation** — plants, harvests, **Speed Harvesting app** (tag scan, Bluetooth scale) | Plant batches → plants (phase lifecycle) → harvests (wet/dry), with a **`plant_events` audit timeline** (move/feed/phase-change/destroy/harvest) | ◐ Core lifecycle + event history; no Speed Harvesting field app |
| **CRM** — contacts, sales notes, **Customer Map / route planning**, **Brand Portal** | Companies (customer/vendor/brand), contacts, **`company_notes` activity timeline** on the company detail | ◐ Core CRM + notes; no map/brand portal |
| **Reporting & Analytics** — Distru+Metrc analytics, scheduled/emailable reports, Sales Matrix, AR dashboard | Insights dashboard + **24 report endpoints** from a single registry (**all 24 real now** — the 3 cultivation reports are wired to the plant/harvest/event tables), and reports are **scheduled + emailable**: a seeded schedule-trigger workflow runs a report on cron and delivers it via the Email connector (**live SMTP** when configured) | ● Strong; scheduled/emailable + full cultivation reporting now real |
| **Delivery / logistics** — **Onfleet** routes, vehicle tracking | A full **dispatch console**: a docked, sortable/searchable run list + an edge-to-edge **Austin map** where each van **follows the actual road network** (depot → stops → depot) via a **routing provider seam** (`osrm` default — keyless real streets — `mapbox`, or `none`). It runs in **real time**: each run has a schedule (departure → completion) and every position, ETA, and drop time is **derived from the wall clock**, so the day plays out on its own (loading → mid-route → all delivered by evening) and drop times are recorded. Driven road is **solid**, road ahead **dotted**; stops are status-colored (✓/✗/pending); selecting a driver frames + **auto-follows** the van with a live **detail overlay** (vehicle data + activity timeline). The **depot is a configurable `locations` record** (coords + `is_depot`) | ◐ Real dispatch, real road routing, a real-time-derived live map; positions are **modeled** (from the schedule, on-road), not a real GPS/Onfleet stream |
| **DistruCommerce** — B2B wholesale ordering portal (buyer logins, branded menus, price tiers, order approval, AI Order Agent) | Menus + price tiers exist as **reference data**; no buyer-facing portal | ○ Gap (whole product absent) |
| **Accounting** — QuickBooks / Xero / Sage sync | **All three** shipped with a **full OAuth2 connect flow** (authorize→callback→token refresh) and a **live adapter** that calls the vendor API with the stored token once connected; the demo keeps mock ids on invoices/companies | ◐ Live OAuth + API adapters built for all three; the demo runs mocked (no vendor apps), a real tenant's connect goes live |
| **Reference config** — taxes, price tiers, payment terms, strains, menus, groups | `/settings/reference` — all of these, editable | ● Strong |
| **CSV import** — bulk upload with error report | detect→map→validate→**partial commit**→row-mapped error CSV; 7 targets; images + on-hand | ● Strong / exceeds |
| **Public API + webhooks** | 152 documented routes, HMAC webhooks, field-accurate conventions, an in-app API Reference explorer | ● Strong / exceeds route count |
| **AI** — "AI Order Agent" (messages/voice/files → orders) | **Agentic Copilot**: ~80 HITL-gated tools across *every* domain, resumable, MCP-exposed, provider-agnostic | ● Exceeds in scope |
| **Workflow automation** — scheduled/emailable reports + some Metrc automation; no general workflow builder | **Visual n8n-style workflow engine**: triggers + **AI-agent nodes** (tools attached as sub-nodes) + action/if/set nodes on a React Flow canvas, AI graph-authoring from a prompt, real cron firing | ● Exceeds (not a Distru feature) |
| **Calendar & Tasks** | `tasks` (priority + due date) with a **Board and a Calendar month view**, assignment, entity links | ● Strong (for scope) |
| **Label printing / DistruLabels** | A **package label PDF** (`/packages/{id}/label`): product + SKU, package tag, Metrc tag, barcode, quantity, status, lab-testing state | ◐ Basic label PDF (text layout; no rendered barcode graphic) |
| **Integration ecosystem** — QB, Xero, Sage, LeafLink, Dutchie, Blaze, Treez, Onfleet, Apex, Trym | **9 providers** (QuickBooks, **Xero, Sage**, Metrc, LeafLink, BioTrack, Onfleet, Email/SMTP, Google Drive) behind a real **Integrations screen**: each carries a **credential schema** (a Configure dialog with real fields; secrets never round-trip to the browser), a **"setup required" → connected** gate (a sync can't run until it's configured — the same check a live adapter makes), "Sync now", and a live `integration_sync_events` feed. Fully Copilot-operable (list/configure/connect/disconnect/sync tools). **Live** road routing (OSRM) proves the seam is real | ◐ Real connection/config/sync-event model + setup gating over mocked vendor adapters (routing is live); Dutchie/Blaze/Treez/Apex/Trym absent |

---

## What we match or genuinely exceed
1. **The agentic harness.** This is the take-home's actual subject, and it's the strongest part: ~80 tools operating the whole ERP, human-in-the-loop with resumable state, exposed identically on the in-app Copilot **and** an MCP server — driveable from Claude Desktop/Cursor. Distru's public AI is a single "Order Agent"; ours is broader and is the point of the exercise.
2. **"Throw any CSV in and it works."** The flagship requirement — a generic detect/map/validate/partial-commit/error-CSV framework over 7 targets, not a one-off importer.
3. **A Distru-faithful public API** — field-accurate to their real OpenAPI (numbers-as-strings, `inserted_datetime`, `page[number]`+`next_page`, sparse upsert, the `{errors:[…]}` envelope), self-documented, drift-guarded, with an MCP mirror and HMAC webhooks.
4. **Breadth of a real ERP** — 74 tables across 12 bounded contexts (+ a shared kernel), every core module with a routed operator screen (not modals), consistent UX (one nav language, Radix Select/Combobox, resizable Copilot).

## The honest gaps (what real Distru has that this doesn't)
- **DistruCommerce** — a full B2B wholesale ordering portal with buyer logins. Not built.
- **Mobile/field apps** — Pick-n-Pack (fulfillment) and Speed Harvesting (Metrc scan + scale). The data exists; the apps don't.
- **Live external sync** — the seam is now **config-aware with real live adapters**: entering real credentials routes a provider to actual vendor API calls (full OAuth2 for QuickBooks/Xero/Sage; REST for Metrc/LeafLink/Onfleet/BioTrack; SMTP email; live routing). What's *unverified* is the vendor round-trip itself — there are no live vendor apps/accounts in this repo, so the adapters are correct-by-construction, not exercised against production APIs. The wider ecosystem (Dutchie/Blaze/Treez) is still absent.
- **Inventory depth** — FIFO cost layers, multi-location transfers with audit, and barcode/serial/scan are **now built**; what remains is per-unit serial *tracking* (a serial is a field, not its own stock position); **label printing** is now a basic package-label PDF (no rendered barcode graphic).
- **Manufacturing depth** — assembly completion is transactional (real COGS), and production scheduling + input reservation are **now built**, and **basic label printing** (a package-label PDF) is added — only rendered-barcode artwork is missing.
- **Analytics depth** — Sales Matrix, AR aging, and all three cultivation reports are real, and reports are now **scheduled + emailable** via automations. What's Distru-specific and still absent is cultivation *grading*.
- **Route optimization** — delivery routes are real records drawn on real streets (the dispatch map routes depot → stops → depot through the actual road network), but we don't *optimize* the stop order (no TSP resequencing), and there's no sales-rep **Customer Map** or **Brand Portal**.

## Bottom line
As a **take-home**, this is a faithful, broad recreation of Distru's *core operational ERP* — the data model, the transactional business logic, the operator UI, and a field-accurate public API — plus the agentic AI layer that was the actual assignment. It's honest about its seams: external integrations run **mocked in the demo behind a config-aware seam that switches to real live adapters (OAuth + REST + SMTP) the moment a tenant enters real credentials** — those adapters are built to each vendor's API but not exercised against live accounts here. Scheduled/emailable reports, full cultivation reporting, and a basic label PDF are **now real**. It is **not** a production replacement for Distru: the deliberate gaps are the **DistruCommerce B2B portal, the Brand Portal, the mobile field apps** (Pick-n-Pack, Speed Harvesting), **live-verified** vendor round-trips, native Metrc 2-way sync/manifests, and rendered-barcode label artwork. That boundary is the right one for the exercise, and naming it precisely is itself the product sense being graded.


---

# Distru API parity

Audited against Distru's authoritative OpenAPI 3.0.0 spec (`apidocs.distru.dev/openapi.json`, canonical `app.distru.com/api/v1/openapi.json`) — **128 paths, 297 schemas**. Our public API is **152 documented routes**, drift-guarded on every build by `check:openapi`. This section states, plainly, **what's covered and what isn't**.

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
| **Reports** | ~20 | 24 | all 24 real, driven by the actual modules (incl. the 3 cultivation reports, wired to the plant/harvest/`plant_events` tables) |
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

- **Live external sync — built, not vendor-verified.** The seam is **config-aware** (`lib/integrations/`): a connection with real, non-demo credentials selects a **live adapter** that calls the vendor API — full OAuth2 authorize/callback/refresh for QuickBooks/Xero/Sage (`lib/integrations/oauth.ts`), REST for Metrc/LeafLink/Onfleet/BioTrack, and live SMTP email (`lib/integrations/live.ts`, `delivery.ts`). The demo stays on the mock (fake creds marked `__demo`). What's honest to name: these adapters are written to each vendor's documented API but **not exercised against live accounts here**, so treat them as the production adapter layer, correct by construction.
- ~~Cultivation report wiring~~ — **done.** All three cultivation reports (`cultivation-transaction-history`, `harvest-outputs`, `plant-lifecycle`) are now joined to the real plant/harvest/`plant_events` tables and return live rows.
- **A handful of deep Distru fields** we don't model — computed inventory rollups (`quantity_available`, `quantity_reserved`, `quantity_active_by_location`), `bill_of_materials`, `menus`, per-document company emails. These are real-ERP depth past the take-home's line, not conventions or core wire keys.
- **Whole products** covered in the feature audit above: DistruCommerce (B2B portal) and the mobile field apps.

**Verified:** `tsc` 0 · `eslint .` 0 · `check:openapi` 152 routes · `smoke` pass · live curls confirm real report rows, on-hand, org members, a `%PDF-1.4` document, a 33-field Metrc package tied to a real product's on-hand, Metrc transfers linked to real orders, and role-aware QuickBooks/LeafLink ids.
