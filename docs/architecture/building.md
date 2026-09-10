---
title: "Decisions, scope and building"
section: "Copilot & take-home"
summary: "Edge-case decisions, what is MVP vs deferred, and the order to build it in."
keywords: ["decisions","edge cases","product decisions","mvp","deferred","scope","build","rebuild","roadmap","spec"]
order: 115
---
# Decisions, scope and building

## Edge cases and product decisions

| Situation | Decision | Why |
|---|---|---|
| Arbitrary columns | Model mapping seeded by a deterministic matcher, with fallback | Deterministic handles the 80% cheaply and offline; the model handles the long tail; fallback degrades rather than breaks |
| Ambiguous or unmappable file | Classifier returns confident / ambiguous / none; confirm, ask, or refuse | A wrong guess on real inventory is worse than a question |
| 10k rows vs context | Rows in Postgres; model sees headers, sample, aggregates | Correctness, cost, and scale at once |
| Validation failures | Partial success plus a row-mapped error CSV | 9,850 good rows should not be blocked by 150 bad ones |
| Unknown category / vendor | Flagged as a new reference; created on commit (gated when many) | Onboarding files routinely introduce new brands |
| Unknown unit type | Hard error | Units are a fixed, compliance-relevant set; inventing one is wrong |
| Duplicate SKU | Upsert by SKU (last wins) | Re-uploading a corrected file must be idempotent |
| Prices like "$3.25", "1,200" | Coerced; "twenty" is an error | Obvious coercions succeed; ambiguous ones fail loudly |
| Any mutation | Confirmation gate; the card is the ask | This mutates real inventory; the model should not ask twice in prose |
| Multitenancy | organization_id on every row plus an org-scoped context at the tool boundary | Isolation is structural, not per-query discipline |

## What we have, and where the boundary is

The platform is now both **broad and deep** - a transactional seed-to-sale ERP with an agentic harness woven through it, not a CSV importer with a demo shell.

**Built and running:**

- **Multitenancy and governance** - org-scoped auth and services, `organization_id` on every row, and an audit log on every mutation.
- **The harness** - a streaming loop, a provider-agnostic model seam (Anthropic ↔ OpenAI is an env flip), per-tool HITL (confirm / `ask_user`) that pauses mid-turn and resumes from Postgres, and a trigger-agnostic runner that powers chat and unattended automations identically. **~80 tools across every domain.**
- **Depth per domain** - transactional inventory (an on-hand ledger, transfers between locations, scan), sales (orders → invoices → payments, returns/credits), purchasing (POs, receiving), manufacturing (assemblies + scheduling), cultivation and grow (plant batches, phases, harvests, packaging, COAs), compliance (licenses, test results, expiry), logistics/deliveries, CRM notes, and tasks/calendar.
- **The import pipeline** - detect → map → validate → partial-commit → error-CSV, end to end, with seven targets and 100 → 10,000+ rows.
- **Five faces on one service layer** - the Copilot, a Distru-faithful **REST API of 150 self-documented routes** (build-time OpenAPI drift guard) with an interactive **API Reference explorer** at `/api-reference`, the **MCP server** exposing the full domain surface (65 tools), the bulk `/upload-products` engine, and HMAC-signed webhooks.
- **Reporting** - 24 standard reports in one registry, shared by the Insights UI, the `/reports/*` API, and the `generate_report` tool, snapshotable as durable Report artifacts.
- **The visual workflow engine** - n8n-shaped node-graph automations with AI-agent nodes, real cron scheduling, and a produce → deliver → notify loop (Reports, email/Drive delivery, notifications).
- **The integration ecosystem** - API-accurate mock providers (Metrc, QuickBooks, LeafLink, BioTrack, plus email/Drive) behind a real, env-selected seam.
- **A routed operator screen for every domain** - dashboard, insights, reports, notifications, inventory (+ packages/batches/bins), categories, companies, sales (+ returns/credits/payments), purchasing, manufacturing, compliance, cultivation, fleet, automations, reference data, settings, integrations, docs.

**The honest remaining boundary:** the one thing genuinely not real is **live** third-party sync - the Metrc/QuickBooks/LeafLink adapters and email/Drive delivery run as API-accurate mocks behind an interface a live adapter drops into, and are labeled as such. Beyond that: queue-backed imports past 10k rows (the pipeline is already chunked and job-backed); a durable workflow runtime (Inngest/Temporal) and live entry points for webhook/event trigger nodes behind the in-process executor (cron already fires for real); MCP-*client* ingestion of a customer's own connected servers into the registry; the Billing screen (no backend); and RBAC beyond org membership. Each is an adapter against a seam that already exists, not a rewrite.

## Build it from scratch

If there were no demo, this is the order to rebuild it. Each step depends only on the ones above it, which is what keeps the service layer the single source of truth.

1. **Scaffold** - create-next-app (App Router, TS), Tailwind v4, Drizzle + postgres.js, better-auth with the organization plugin, UUIDv7 across auth and domain rows.
2. **Data model** - author the schema in `db/schema/*` and push; every domain table carries organization_id, and on-hand is the ledger, not a column.
3. **Domain modules** - bounded-context modules in `lib/modules/*` (`catalog`, `inventory`, `sales`, `platform`, `imports`) over a `shared` kernel, each with a public barrel. Org-scoped, the only code that touches the DB, with an enforced dependency direction.
4. **Harness core** - the tool contract and registry, the streaming runner, the HITL persist/resume, the ask_user gate, and an audit write on every mutation.
5. **Tools** - catalog reads (gate none), mutations (gate confirmation with a preview), the import tools, docs tools, and workflow tools.
6. **Import framework** - the ImportTarget seam, the detection classifier, the mapping matcher, the chunked pipeline, the error-CSV builder, and the seven targets.
7. **Faces** - chat NDJSON routes and `/resume`; `/api/v1/*` with Distru conventions; the `/api/mcp` JSON-RPC server; `/api/upload-products`; HMAC-signed webhooks.
8. **Automations** - the workflow tables, the n8n-shaped node-graph model + executor (agent / action / if / set nodes, run against a shared context), `runWorkflow` driving the runner with autoApprove, real cron scheduling (a `tick` endpoint), the produce → deliver → notify loop (`save_report`/`generate_report` artifacts, email/Drive delivery, notifications), and the React Flow canvas + JSON builder.
9. **App shell** - the context-driven sidebar, the floating Copilot panel, the dashboard, inventory / companies / categories CRUD, docs, and the integrations directory.
10. **Verify** - typecheck, lint (including the architecture-boundary rules), and a green production build; an offline smoke test that drives the modules and the full import pipeline against Postgres with no model spend; curl each face with a minted token.

The one place worth investing next is an **eval harness for column-mapping accuracy** - mapping quality is the actual product, and it is where regression testing pays for itself immediately.
