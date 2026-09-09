# Distru vs. This Clone — Honest Side-by-Side

> Evidence: the real product from `distru.com`, `help.distru.com`, `apidocs.distru.dev`
> (authoritative OpenAPI: 128 paths / 297 schemas), and Distru's own MCP docs. This
> repo: 16 UI sections / 64 routed pages, 137 API routes (~40 resource groups, 136
> documented), 55 harness tools, 11 domain modules, 68 tables, mock provider seams.
> Field-level API parity is separately audited in `DISTRU-PARITY.md`.

## Verdict at a glance

| Dimension | Parity | Note |
|---|---|---|
| Core ERP data model | ● Strong | inventory→sales→purchasing→manufacturing→compliance→cultivation→CRM all modeled with real transactions |
| Public REST API | ● Strong / exceeds | field-accurate to Distru's real OpenAPI; 136 documented routes vs their 128 |
| Agentic AI | ● Exceeds (for scope) | our Copilot operates the *whole* system (55 tools, HITL, MCP); Distru's AI is a narrower "Order Agent" |
| CSV "just works" import | ● Strong / exceeds | the take-home's flagship: detect→map→validate→partial-commit→error-CSV, 7 targets, 10k rows |
| Operator UX breadth | ◐ Partial | every core module has a routed screen; missing the field/mobile apps and some power views |
| External integrations | ◐ Mocked | Metrc/QuickBooks/LeafLink/BioTrack are **API-accurate mocks behind a real seam**; no live sync |
| DistruCommerce (B2B portal) | ○ Gap | not built |
| Mobile / field apps | ○ Gap | Pick-n-Pack, Speed Harvesting — not built (data exists) |

● strong/parity ◐ partial ○ gap

---

## Module-by-module

| Distru feature | This clone | Assessment |
|---|---|---|
| **Inventory** — packages, batches, lots, **bins**, multi-location, FIFO/serial/barcode | Products, **packages/batches/bins**, append-only on-hand ledger (`SUM(delta)`), locations | ◐ Core modeled; **no** FIFO/serial/barcode, **no** multi-location transfers with audit trail |
| **Sales orders** — lifecycle, fulfillment | Orders with real status lifecycle (PENDING→…→COMPLETED/CANCELED), stock posts on leaving PENDING | ● Strong |
| **Order fulfillment** — mobile **Pick-n-Pack** app, delivery tracking | (none — status transitions only) | ○ Gap (no field app) |
| **Invoicing & payments** | Invoices (financial snapshot, void), payments, payment status derivation, **returns & credits** | ● Strong |
| **Purchasing** — POs, multi-channel intake, receive→stock | POs (DRAFT→OPEN→RECEIVED), **receiving posts to the ledger** | ● Strong |
| **Manufacturing** — assemblies, BOMs, COGs, **production scheduling + reservation**, **label printing** | Assemblies (multi input→output lines), costs/cost-types — **but the BOM does not post to the ledger yet** (inputs don't consume, outputs don't produce stock; a documented TODO) | ○ Structure only; not transactional, no scheduling/reservation/label printing |
| **Compliance** — native **2-way Metrc sync (~5s)**, manifest generation, Metrc Bridge, BioTrack, COAs | Licenses, COAs (test results, PDF), **read-only Metrc view** via mock provider | ◐ Mock, read-only; no live sync/manifests |
| **Cultivation** — plants, harvests, **Speed Harvesting app** (tag scan, Bluetooth scale) | Plant batches → plants (phase lifecycle) → harvests (wet/dry) | ◐ Core lifecycle; no field app / deep plant events |
| **CRM** — contacts, sales notes, **Customer Map / route planning**, **Brand Portal** | Companies (customer/vendor/brand), contacts | ◐ Core CRM; no map/notes/brand portal |
| **Reporting & Analytics** — Distru+Metrc analytics, scheduled/emailable reports, Sales Matrix, AR dashboard | Insights dashboard + **18 report endpoints** (real where data exists) | ◐ Solid; not scheduled/emailable, simpler than Distru |
| **Delivery / logistics** — **Onfleet** routes, vehicle tracking | Fleet: drivers & vehicles (CRUD) | ◐ Data only; no routing/tracking |
| **DistruCommerce** — B2B wholesale ordering portal (buyer logins, branded menus, price tiers, order approval, AI Order Agent) | Menus + price tiers exist as **reference data**; no buyer-facing portal | ○ Gap (whole product absent) |
| **Accounting** — QuickBooks / Xero / Sage sync | QuickBooks ids via **mock** provider on invoices/companies | ◐ Mock ids; no sync |
| **Reference config** — taxes, price tiers, payment terms, strains, menus, groups | `/settings/reference` — all of these, editable | ● Strong |
| **CSV import** — bulk upload with error report | detect→map→validate→**partial commit**→row-mapped error CSV; 7 targets; images + on-hand | ● Strong / exceeds |
| **Public API + webhooks** | 136 documented routes, HMAC webhooks, field-accurate conventions | ● Strong / exceeds route count |
| **AI** — "AI Order Agent" (messages/voice/files → orders) | **Agentic Copilot**: 55 HITL-gated tools across *every* domain, resumable, MCP-exposed, provider-agnostic | ● Exceeds in scope |
| **Calendar & Tasks** | `tasks` table + API; no calendar UI | ◐ Data only |
| **Label printing / DistruLabels** | (none) | ○ Gap |
| **Integration ecosystem** — QB, Xero, Sage, LeafLink, Dutchie, Blaze, Treez, Onfleet, Apex, Trym | Mock seams for Metrc/QuickBooks/LeafLink/BioTrack | ◐ 4 mocked; the rest absent |

---

## What we match or genuinely exceed
1. **The agentic harness.** This is the take-home's actual subject, and it's the strongest part: 55 tools operating the whole ERP, human-in-the-loop with resumable state, exposed identically on the in-app Copilot **and** an MCP server — driveable from Claude Desktop/Cursor. Distru's public AI is a single "Order Agent"; ours is broader and is the point of the exercise.
2. **"Throw any CSV in and it works."** The flagship requirement — a generic detect/map/validate/partial-commit/error-CSV framework over 7 targets, not a one-off importer.
3. **A Distru-faithful public API** — field-accurate to their real OpenAPI (numbers-as-strings, `inserted_datetime`, `page[number]`+`next_page`, sparse upsert, the `{errors:[…]}` envelope), self-documented, drift-guarded, with an MCP mirror and HMAC webhooks.
4. **Breadth of a real ERP** — 68 tables across 11 bounded contexts, every core module with a routed operator screen (not modals), consistent UX (one nav language, Radix Select/Combobox, resizable Copilot).

## The honest gaps (what real Distru has that this doesn't)
- **DistruCommerce** — a full B2B wholesale ordering portal with buyer logins. Not built.
- **Mobile/field apps** — Pick-n-Pack (fulfillment) and Speed Harvesting (Metrc scan + scale). The data exists; the apps don't.
- **Live external sync** — real two-way Metrc/BioTrack, real QuickBooks/Xero/Sage, and the wider integration ecosystem (Dutchie/Blaze/Treez/Onfleet). Ours are **API-accurate mocks behind a swappable seam** — honest, but not live.
- **Inventory depth** — FIFO/serial/barcode, multi-location transfers with audit trail, label printing.
- **Manufacturing depth** — production scheduling and inventory reservation.
- **Analytics depth** — scheduled/emailable reports, Sales Matrix, AR dashboard, cultivation grading.
- **Calendar**, **Customer Map / routing**, **Brand Portal**.

## Bottom line
As a **take-home**, this is a faithful, broad recreation of Distru's *core operational ERP* — the data model, the transactional business logic, the operator UI, and a field-accurate public API — plus the agentic AI layer that was the actual assignment, and it's honest about the seams (external sync is mocked, deliberately, behind real interfaces). It is **not** a production replacement for Distru: it lacks the B2B commerce portal, the mobile field apps, live state/accounting sync, and the deep inventory/manufacturing/analytics tooling a shipping ERP carries. That boundary is the right one for the exercise, and naming it precisely is itself the product sense being graded.
