# Distru

[![codecov](https://codecov.io/gh/syntaqx/distru/graph/badge.svg?token=jLOJA2PBME)](https://codecov.io/gh/syntaqx/distru)

A multitenant, Vercel-deployable recreation of the [Distru](https://distru.com) cannabis ERP with an AI **Copilot** on top — a chat assistant that actually runs your catalog, inventory, sales, and manufacturing. Built as a take-home ("we are Distru").

> **Reviewers:** get it running below, then read the deep docs — the graded deliverables (the tech spec and the Loom script) live under [`docs/`](./docs/) and render in-app at **`/docs`** once you spin it up. This README is the on-ramp, not the spec; it points you at the docs rather than repeating them.

---

## Quickstart

### Docker (one command)

```bash
cp .env.example .env            # set ANTHROPIC_API_KEY (one may already be present)
docker compose up -d --build    # app + Postgres, pushes schema, seeds, runs dev
```

App at **http://localhost:3000** (first boot ~a minute to build). Logs: `docker compose logs -f app` · stop: `docker compose down`.

### Host (Node local, Postgres in Docker)

```bash
cp .env.example .env
npm install
docker compose up -d postgres   # database only, on :5432
npm run db:push && npm run db:seed
npm run dev
```

Sign in with the seeded demo tenant (pre-filled on the login page):

```text
demo@distru.test / distru1234
```

New sign-ups get their own seeded workspace too.

---

## Try it

- **Talk to the Copilot** — a floating window on any page (topbar button or **⌘/Ctrl+J**). *"Set Blue Dream 3.5g on-hand to 200," "sell 10 Blue Dream to Green Leaf Dispensary," "what's my lowest-stocked SKU?"* Every mutation is an approve/reject card; it refreshes the page behind it live.
- **Drop a CSV on it** — drag any of the files in [`samples/`](./samples/) onto the Copilot; it detects what the file is, asks what to do, maps columns, validates, partial-commits, and hands back a row-mapped error CSV. `catalog-10k.csv` shows scale; `catalog-broken.csv` shows the error path.
- **Watch stock flow costed** — receive a PO, run a manufacturing assembly (it consumes inputs FIFO and rolls real COGS into the output), transfer between locations, and sell — margin and FIFO valuation are real end to end. See **Inventory → Valuation** and an order's gross-margin card.
- **Build an automation** — **Automations** is a visual (n8n-style) canvas with an AI-agent node; author by hand or from a prompt, run it, and schedule it on a real cron.
- **Mint an API token** on **Integrations** for ready-made REST / MCP / bulk-upload snippets.

---

## Verify it's real

```bash
npm run smoke     # drives the service layer + full import pipeline against Postgres, no LLM spend; prints an API token
```

Then hit the faces with that token (`TOKEN=dk_live_…`):

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/public/v1/products      # Distru-shaped REST API
curl -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'                                # MCP server
curl -X POST http://localhost:3000/api/upload-products -H "Authorization: Bearer $TOKEN" \
  -F file=@samples/messy-catalog.csv                                                 # bulk engine
```

The Copilot, REST API, MCP server, bulk engine, and webhooks all write to the **same** Postgres — one service layer, many faces.

---

## Documentation

All docs are markdown under [`docs/`](./docs/) and render in-app at **`/docs`** (one source, compiled at build). Two tracks:

- **Product docs** ([`docs/product/`](./docs/product/)) — how each module works, operator-facing.
- **Engineering & take-home** ([`docs/architecture/`](./docs/architecture/)) — the tech spec, in two groups:
  - *Platform architecture* — [architecture overview](./docs/architecture/architecture.md), [modular architecture](./docs/architecture/modular-architecture.md), [data model](./docs/architecture/data-model.md), [the Distru domain](./docs/architecture/distru-domain.md), [the inventory engine](./docs/architecture/inventory-engine.md), [fidelity audit](./docs/architecture/fidelity.md).
  - *Copilot & take-home* — [the harness](./docs/architecture/harness.md), [one capability, two faces](./docs/architecture/two-faces.md), [the import pipeline](./docs/architecture/import-pipeline.md), [the workflow engine](./docs/architecture/workflow-engine.md), [decisions & scope](./docs/architecture/building.md), [take-home answer](./docs/architecture/take-home.md), and the **[Loom script](./docs/architecture/loom.md)**.

Agents get first-class entry points generated from the same docs: [`/llms.txt`](http://localhost:3000/llms.txt), [`/llms-full.txt`](http://localhost:3000/llms-full.txt), and [`/skill.md`](http://localhost:3000/skill.md).

---

## Use your own agent (MCP)

Distru exposes an MCP server (same tool surface as the built-in Copilot), so you can drive it from Claude Code, Claude Desktop, or Cursor. Mint a token on **Integrations** (or `npm run token`), then:

```bash
claude mcp add --transport http distru http://localhost:3000/api/mcp \
  --header "Authorization: Bearer dk_live_..."
```

Details and the config-JSON form: **Docs → Copilot & take-home → One capability, two faces**.

---

## Deploy (Vercel)

| Var | Value |
|---|---|
| `DATABASE_URL` | A **pooled** Postgres URL. With the Neon / Vercel Postgres integration it's auto-detected from `POSTGRES_URL`. |
| `BETTER_AUTH_SECRET` | A strong random secret (`openssl rand -base64 32`). |
| `BETTER_AUTH_URL` / `APP_URL` | The deployed origin, e.g. `https://distru.syntaqx.com`. |
| `ANTHROPIC_API_KEY` | For the Copilot / automations. |

Optional: `ANTHROPIC_MODEL` (default `claude-opus-5`), `MODEL_PROVIDER=openai` + `OPENAI_API_KEY` to run on OpenAI, and the integration seams (`METRC_PROVIDER`, `EMAIL_PROVIDER`, `DRIVE_PROVIDER`, …; all default `mock`, set `none` to show unconnected). `CRON_SECRET` enables the scheduled-automation cron ([`vercel.json`](./vercel.json)).

**This is a demo deployment.** `vercel-build` runs `db:push` then **`db:reset`** (a full purge + reseed) before `next build`, so every deploy comes up on the latest schema with a fresh demo tenant — and a nightly cron does the same (`ENABLE_STAGING_RESET=1` + `CRON_SECRET`). Point it only at a throwaway database.

---

## Project layout

```text
app/            Next routes — (auth) + (app) UI, /api/*, the public API under /public/v1/*, /docs
components/     UI — the app chrome + the Copilot window (components/chat/*)
db/schema/      Drizzle schema by owning module (catalog, inventory, sales, compliance, …)
lib/
  modules/      the platform domain as bounded-context modules, each with a public barrel
  harness/      the agentic Copilot — tool registry, streaming runner, HITL, workflow graph
  imports/      the generic import framework (add one file in targets/ to add a type)
docs/           all documentation (renders at /docs)
scripts/        seed.ts · reset.ts · smoke.ts · build-docs.ts
samples/        example CSVs for the import demo
```

The dependency direction (domain modules never import the Copilot; callers import a module's barrel, not its internals) is enforced by ESLint — see **Docs → Modular architecture**.
