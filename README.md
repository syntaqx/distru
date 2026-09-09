# Distru

A multitenant, Vercel-deployable clone of the Distru cannabis ERP with an AI **Copilot** layer built on top - a chat assistant that actually runs your catalog and inventory (this is a take-home; "we are Distru").

> **Reviewers:** this README is the entry point (what it is, how to run, how I verified it, and where I went beyond the ask). **[SPEC.md](./SPEC.md)** is the required tech spec - the harness design and reasoning. The Loom outline is at the bottom.

---

## What this is

Drop a CSV of **any** layout into the copilot and it *just works*: the agent detects what the file is (product catalog, price sheet, customer/vendor list, inventory count), asks what you want to do, maps the columns, validates every row, imports the valid ones, and hands back a row-mapped error CSV for the rest - after a single approval. You can also just talk to it: *"add this product," "set Blue Dream on-hand to 200," "what's my lowest-stocked SKU?"*

It's built as a reusable **agentic harness** on a faithful Distru clone, following one idea:

> **A modular platform, with a Copilot on top.** Piece 1 is a rewritten Distru: an org-scoped **domain of bounded-context modules** (`lib/modules/*`) that is the single source of truth and has no dependency on the AI. Piece 2 is the **agentic Copilot** (`lib/harness/*`) layered over it. On the same domain sit a Distru-compatible **public REST API**, an **MCP server** (so an external agent can drive it too), the internal **`/upload-products`** bulk engine, and signed **webhooks**. Adding a capability is one module function plus thin wrappers - which is why chat, API, and imports never disagree.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Drizzle + Postgres · BetterAuth (multitenant, UUIDv7) · Anthropic `claude-opus-5` · lucide-react + streamdown.

---

## Quickstart

### Option A - Docker (recommended, one command)

```bash
cp .env.example .env                 # set ANTHROPIC_API_KEY (a key may already be present)
docker compose up -d --build         # builds the app, starts Postgres, pushes schema, seeds, runs dev
```

App: http://localhost:3000 (first boot takes ~a minute to build and compile). Your source is bind-mounted with a node_modules volume, so edits hot-reload in the container. Follow logs with `docker compose logs -f app`; stop with `docker compose down`.

### Option B - Host (Node on your machine, Postgres in Docker)

```bash
cp .env.example .env
npm install                          # esbuild/unrs-resolver postinstalls are pre-approved via package.json "allowScripts"
docker compose up -d postgres        # just the database on :5432
npm run db:push && npm run db:seed
npm run dev                          # http://localhost:3000
```

Open http://localhost:3000 and sign in with the pre-filled demo tenant:

```text
demo@distru.test / distru1234
```

(Or sign up to create your own workspace - new orgs get seeded sample data too.)

---

## Try it

The Copilot is a **floating window** you can open on any page (from the topbar button or **⌘/Ctrl+J**), drag anywhere, and expand. It acts on the page you're viewing and refreshes it live as it makes changes.

- *"What are my top categories and how much stock do I have?"*
- *"Add a product: Gelato 3.5g, SKU FL-GEL-35, Flower, vendor Sungrown Farms, unit gram, $34"* → **approve** the card → watch it appear on the **Inventory** page behind the window.
- *"Set Blue Dream 3.5g on-hand to 200."*
- *"Sell 10 Blue Dream 3.5g and 5 OG Kush 3.5g to Green Leaf Dispensary"* → **approve** the order card → inventory drops on the **Inventory** page and the order lands on **Sales**. Then *"invoice that order"* and *"record a $200 payment on INV-0003."*
- *"Save an automation that lists every SKU under 25 units"* → then open the Copilot's **history → Automations** tab and hit **Run now**. Automations run unattended (they auto-approve their own actions); a **Low-stock report** is seeded to try.
**Just drop in a CSV** - drag it straight onto the Copilot (or use the paperclip). The agent detects what the file is and asks what to do; you don't have to say "import this." Ready-made samples in `samples/`:

| File | What it shows |
|---|---|
| `catalog-clean.csv` | 25 tidy rows - imports cleanly ("just works") |
| `catalog-10k.csv` | 10,000 rows - scale via chunked validate + commit |
| `catalog-broken.csv` | mostly missing/invalid - partial import + row-mapped error CSV |
| `catalog-upsert-v1.csv` then `-v2.csv` | upload v1, then v2 - upserts by SKU (updates prices, adds new, no duplicates) |
| `messy-catalog.csv` | arbitrary headers + a few bad rows |
| `price-sheet.csv` | detected as a price update by SKU |
| `sales-orders.csv` | detected as sales orders - line items grouped into draft orders |
| `customers.csv` | ambiguous (customers vs vendors) - it asks which |
| `invoices.csv` | unsupported - it refuses instead of guessing |

Regenerate or resize them anytime: `npm run samples` (e.g. `npm run samples -- 20000` for a bigger one).

On **Integrations**: mint an API token and copy the ready-made REST / MCP / bulk-upload snippets.

---

## Verify it's real (no hand-waving)

```bash
npm run smoke     # drives the service layer + full import pipeline against Postgres, no LLM spend; prints an API token
```

Then hit the other faces with that token (`TOKEN=dk_live_…`):

```bash
# Distru-shaped REST API (Bearer auth, string-numbers, page[number] + next_page, sparse upsert)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/public/v1/products

# MCP server (JSON-RPC over Streamable HTTP) - point Claude Desktop / Cursor here too
curl -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Bulk engine (chunk → validate → partial upload → error CSV)
curl -X POST http://localhost:3000/api/upload-products -H "Authorization: Bearer $TOKEN" \
  -F file=@samples/messy-catalog.csv
```

The REST API and the MCP server write to the **same** Postgres the copilot uses - one source of truth, five faces.

Agents get first-class, Distru-faithful entry points too: [`/llms.txt`](http://localhost:3000/llms.txt) (compact index), [`/llms-full.txt`](http://localhost:3000/llms-full.txt) (full docs inlined), and [`/skill.md`](http://localhost:3000/skill.md) (an Agent Skill of the API conventions), all generated from the same docs the humans read.

---

## Use your own agent (MCP)

Distru exposes an MCP server, so you can drive it from **Claude Code, Claude Desktop, Cursor, or any MCP client** - no Distru UI required. It's the same tool surface the built-in Copilot uses.

1. Get a token - mint one on the **Integrations** page, or from the CLI:

```bash
npm run token                          # host
docker compose exec app npm run token  # Docker
```

2. Point your agent at `http://localhost:3000/api/mcp` with that token.

**Claude Code:**

```bash
claude mcp add --transport http distru http://localhost:3000/api/mcp \
  --header "Authorization: Bearer dk_live_..."
```

**Claude Desktop / Cursor** (MCP config JSON):

```json
{
  "mcpServers": {
    "distru": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer dk_live_..." }
    }
  }
}
```

The MCP tool list is **derived from the Copilot's own tool registry** (via [`lib/harness/mcp-bridge.ts`](lib/harness/mcp-bridge.ts)), not hand-written - a capability is defined once and surfaced on both faces, so they never drift. That means the external agent gets the full surface: reads (`distru-search-products`, `distru-get-product`, `distru-inventory-report`, `distru-list-orders`, `distru-list-invoices`, ...), catalog + inventory mutations (`distru-create-product`, `distru-update-product`, `distru-set-on-hand`, `distru-bulk-update-products`, ...), sales (`distru-create-order`, `distru-create-invoice`, `distru-record-payment`, `distru-cancel-order`, ...), and analytics/reporting (`distru-sales-summary`, `distru-top-products`, `distru-top-customers`, `distru-open-invoices` — best sellers, revenue, and the collections/AR report). Call `tools/list`, or `GET /api/mcp`, for the live set. A system prompt that works well:

> You manage a Distru cannabis-ERP workspace through the `distru-*` MCP tools. Search or get before you mutate, keep SKUs consistent, and confirm anything destructive with the user.

---

## What I built beyond the ask

The exercise asked for a tech spec + Loom. I also built the working platform behind it:

- **A real multitenant SaaS**, not a demo - BetterAuth orgs/members, UUIDv7 everywhere, org-scoped services, deployable to Vercel; an app shell modeled on Distru's real modules (with honest **Preview** tiles for the ones I didn't build).
- **The harness as the product**: a tool registry, a streaming agent loop, a **human-in-the-loop gate** (every mutation is Approve/Reject; `ask_user` for real decisions) that **pauses mid-turn, persists, and resumes** across stateless invocations, and a cross-face **audit log**. It's trigger-agnostic: the same runner powers both the chat Copilot and unattended **Automations** - saved workflows that run headlessly and auto-approve their own actions (attributed to the workflow in the audit log).
- **Five faces on one service layer** (copilot, public REST API, MCP server, bulk engine, webhooks), all verified writing to one DB.
- **A generic import framework**: detection + "what do you want to do with this?" + mapping + chunked validation + partial commit + error CSV - new import types are a single file (`lib/imports/targets/`), so it scales to the long tail (products, price sheets, customer/vendor lists, inventory counts, sales orders today).
- **The agent orchestrates; deterministic code does the heavy lifting** - 10k rows live in Postgres, never in the model's context.
- **Engineering rigor**: typecheck + lint clean, green production build, and **GitHub Actions CI on Node 24** (Postgres service → typecheck → lint → build → push → seed → smoke).

**Honest scope:** this repo *is* Distru - a faithful clone of the slice we need, not wired to production Distru (conventions mirror theirs so the real API/MCP could drop in behind the service layer). Every nav item works (Inventory, Categories, Companies, **Sales**, Automations, Integrations), with editing on real routed pages, not modals. The dashboard's Purchasing / Manufacturing / Compliance / Analytics tiles stay **Preview** *in the UI* - but their domain modules, public REST API, MCP tools, and OpenAPI docs are already built (the API spans ~40 resource groups / 130 self-documented routes); only the operator screens are deferred.

---

## Project layout

```text
app/            Next routes - (auth) + (app) UI, /api/*, and the public API under /public/v1/*
components/     UI - the app chrome + the Copilot window (components/chat/*)
db/schema/      Drizzle schema by owning module (catalog, inventory, sales, platform, imports, ...)
lib/
  modules/      PIECE 1 - the platform domain as bounded-context modules, each with a public
                index.ts barrel: shared (kernel) · catalog · inventory · sales · platform · imports
  harness/      PIECE 2 - the agentic Copilot: tool contract, registry, streaming runner, HITL,
                tools/*, plus conversation + automation persistence. Sits on top of modules.
  imports/      generic import framework - detection, mapping, pipeline; targets/* (add one file to add a type)
scripts/        seed.ts (demo tenant), smoke.ts (offline end-to-end proof)
samples/        example CSVs for the import demo
```

The dependency direction is enforced by ESLint (`eslint.config.mjs`): domain modules may not import the Copilot, and callers import a module's barrel, not its internals - see the in-app **Docs → Platform architecture → Modular architecture**.

---

## Deploy (Vercel)

Set `DATABASE_URL` to a pooled Neon / Vercel Postgres string, plus `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, and a model provider: `ANTHROPIC_API_KEY` (default), or set `MODEL_PROVIDER=openai` with `OPENAI_API_KEY` (optionally `OPENAI_MODEL` / `OPENAI_BASE_URL`). Run `npm run db:push` against that database. Otherwise it's Vercel-native.

---

## Notes

- Everything is UUIDv7 and org-scoped; API tokens are stored hashed; webhooks are HMAC-signed; every mutation (from any face) is written to the audit log.
- `npm run db:push` uses `--force` (non-interactive). Reset the demo tenant anytime: drop the schema
  (`docker exec distru-postgres psql -U distru -d distru -c "drop schema public cascade; create schema public;"`),
  then re-run push + seed - inside the container with `docker compose exec app sh -c "npm run db:push && npm run db:seed"` (Option A) or on the host with `npm run db:push && npm run db:seed` (Option B).
- `compose.yml` runs the app + Postgres; `Dockerfile` is the dev image. Config is read from `.env` (compose overrides `DATABASE_URL` to reach Postgres over the compose network).
- `AGENTS.md` is auto-generated by `next dev` and gitignored - ignore it.

---

## Loom outline (deliverable #2)

**How I used AI** - researched Distru's real API/MCP/brand to make the clone faithful; used Claude Code to build and iterate, verifying each layer live (curl + DB checks) rather than trusting it worked.

**Key decisions (with alternatives/tradeoffs)**
- *One service layer, many faces* vs. a one-off CSV importer - chose the substrate so chat/API/MCP/workflows share one source of truth.
- *Manual streaming loop* vs. the SDK tool-runner - needed serverless-safe pause/resume for human-in-the-loop.
- *Agent orchestrates, deterministic code does the heavy lifting* - model sees headers + sample + aggregates, never 10k rows.
- *Detect-then-ask* imports vs. assume-products - richer product feel, exposes the multi-target framework.

**What I'd do next** - queue-backed >10k imports and a scheduler to fire the existing **Automations** on a cron/webhook (manual runs work today; the runner is already trigger-agnostic); an **eval harness for mapping accuracy** (mapping quality is the product); more targets, full API parity, RBAC, and a real Distru/MCP adapter behind the same service layer.
