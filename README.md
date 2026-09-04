# Distru AI

The agentic AI layer for the Distru cannabis ERP - a multitenant, Vercel-deployable clone of the slice of Distru we need, with a chat copilot that actually runs your catalog and inventory.

> **Reviewers:** this README is the entry point (what it is, how to run, how I verified it, and where I went beyond the ask). **[SPEC.md](./SPEC.md)** is the required tech spec - the harness design and reasoning. The Loom outline is at the bottom.

---

## What this is

Drop a CSV of **any** layout into the copilot and it *just works*: the agent detects what the file is (product catalog, price sheet, customer/vendor list, inventory count), asks what you want to do, maps the columns, validates every row, imports the valid ones, and hands back a row-mapped error CSV for the rest - after a single approval. You can also just talk to it: *"add this product," "set Blue Dream on-hand to 200," "what's my lowest-stocked SKU?"*

It's built as a reusable **agentic harness** on a faithful Distru clone, following one idea:

> **One service layer, many faces.** A single org-scoped service layer is the source of truth. On top sit the AI copilot, a Distru-compatible **public REST API**, an **MCP server** (so an external agent can drive it too), the internal **`/upload-products`** bulk engine, and signed **webhooks**. Adding a capability is one service function plus thin wrappers - which is why chat, API, and imports never disagree.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Drizzle + Postgres · BetterAuth (multitenant, UUIDv7) · Anthropic `claude-opus-5` · lucide-react + streamdown.

---

## Quickstart

```bash
cp .env.example .env          # set ANTHROPIC_API_KEY (a key may already be present)
npm install                   # esbuild/unrs-resolver postinstalls are pre-approved via package.json "allowScripts"
docker compose up -d          # local Postgres on :5432
npm run db:push               # create the schema
npm run db:seed               # seed the demo tenant + sample catalog
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000 and sign in with the pre-filled demo tenant:

```text
demo@distru.test / distru1234
```

(Or sign up to create your own workspace - new orgs get seeded sample data too.)

---

## Try it

The Copilot is a **dock** on every page (open it from the sidebar, the floating button, or **⌘/Ctrl+J**). It acts on the page you're viewing and refreshes it live as it makes changes.

- *"What are my top categories and how much stock do I have?"*
- *"Add a product: Gelato 3.5g, SKU FL-GEL-35, Flower, vendor Sungrown Farms, unit gram, $34"* → **approve** the card → watch it appear on the **Inventory** page behind the dock.
- *"Set Blue Dream 3.5g on-hand to 200."*
- Attach a file from `samples/` and send - the agent **detects what it is** and asks what to do:
  - `messy-catalog.csv` → product catalog (partial import + error CSV)
  - `customers.csv` → customer list (CRM companies)
  - `price-sheet.csv` → price sheet (updates prices by SKU)
  - rename the headers to `Distributor, Email` and it detects a vendor/distributor list

On **Integrations**: mint an API token and copy the ready-made REST / MCP / bulk-upload snippets.

---

## Verify it's real (no hand-waving)

```bash
npm run smoke     # drives the service layer + full import pipeline against Postgres, no LLM spend; prints an API token
```

Then hit the other faces with that token (`TOKEN=dk_live_…`):

```bash
# Distru-shaped REST API (Bearer auth, string-numbers, page[number], sparse upsert)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/public/v1/products

# MCP server (JSON-RPC over Streamable HTTP) - point Claude Desktop / Cursor here too
curl -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Bulk engine (chunk → validate → partial upload → error CSV)
curl -X POST http://localhost:3000/api/upload-products -H "Authorization: Bearer $TOKEN" \
  -F file=@samples/messy-catalog.csv
```

The REST API and the MCP server write to the **same** Postgres the copilot uses - one source of truth, five faces.

---

## What I built beyond the ask

The exercise asked for a tech spec + Loom. I also built the working platform behind it:

- **A real multitenant SaaS**, not a demo - BetterAuth orgs/members, UUIDv7 everywhere, org-scoped services, deployable to Vercel; an app shell modeled on Distru's real modules (with honest **Preview** tiles for the ones I didn't build).
- **The harness as the product**: a tool registry, a streaming agent loop, a **human-in-the-loop gate** (every mutation is Approve/Reject; `ask_user` for real decisions) that **pauses mid-turn, persists, and resumes** across stateless invocations, and a cross-face **audit log**. It's trigger-agnostic - ready for a future cron/webhook workflow.
- **Five faces on one service layer** (copilot, public REST API, MCP server, bulk engine, webhooks), all verified writing to one DB.
- **A generic import framework**: detection + "what do you want to do with this?" + mapping + chunked validation + partial commit + error CSV - new import types are a single file (`lib/imports/targets/`), so it scales to the long tail (products, price sheets, customer/vendor lists, inventory counts today).
- **The agent orchestrates; deterministic code does the heavy lifting** - 10k rows live in Postgres, never in the model's context.
- **Engineering rigor**: typecheck + lint clean, green production build, and **GitHub Actions CI on Node 24** (Postgres service → typecheck → lint → build → push → seed → smoke).

**Honest scope:** this repo *is* Distru - a faithful clone of the slice we need, not wired to production Distru (conventions mirror theirs so the real API/MCP could drop in behind the service layer). The dashboard's Sales Orders / Purchasing / Manufacturing / Compliance / Analytics tiles are intentionally **Preview**; everything with a nav item works.

---

## Project layout

```text
app/            Next routes - (auth) + (app) UI, /api/*, and the public API under /public/v1/*
components/     UI - the app chrome + the Copilot dock (components/chat/*)
db/schema/      Drizzle schema (auth, catalog, inventory, imports, platform, chat)
lib/
  harness/      the agentic harness - tool contract, registry, streaming runner, HITL, tools/*
  imports/      generic import framework - detection, mapping, pipeline; targets/* (add one file to add a type)
  services/     org-scoped domain services - the single source of truth every face calls
scripts/        seed.ts (demo tenant), smoke.ts (offline end-to-end proof)
samples/        example CSVs for the import demo
```

---

## Deploy (Vercel)

Set `DATABASE_URL` to a pooled Neon / Vercel Postgres string, plus `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, and `ANTHROPIC_API_KEY`. Run `npm run db:push` against that database. Otherwise it's Vercel-native.

---

## Notes

- Everything is UUIDv7 and org-scoped; API tokens are stored hashed; webhooks are HMAC-signed; every mutation (from any face) is written to the audit log.
- `npm run db:push` uses `--force` (non-interactive). Reset the demo tenant anytime:
  `docker exec distru-postgres psql -U distru -d distru -c "drop schema public cascade; create schema public;"` then `npm run db:push && npm run db:seed`.
- `AGENTS.md` is auto-generated by `next dev` and gitignored - ignore it.

---

## Loom outline (deliverable #2)

**How I used AI** - researched Distru's real API/MCP/brand to make the clone faithful; used Claude Code to build and iterate, verifying each layer live (curl + DB checks) rather than trusting it worked.

**Key decisions (with alternatives/tradeoffs)**
- *One service layer, many faces* vs. a one-off CSV importer - chose the substrate so chat/API/MCP/workflows share one source of truth.
- *Manual streaming loop* vs. the SDK tool-runner - needed serverless-safe pause/resume for human-in-the-loop.
- *Agent orchestrates, deterministic code does the heavy lifting* - model sees headers + sample + aggregates, never 10k rows.
- *Detect-then-ask* imports vs. assume-products - richer product feel, exposes the multi-target framework.

**What I'd do next** - queue-backed >10k imports and the cron/webhook workflow trigger (seams exist); an **eval harness for mapping accuracy** (mapping quality is the product); more targets, full API parity, RBAC, and a real Distru/MCP adapter behind the same service layer.
