# Distru Agentic Harness - Tech Spec

> Author: Chase Pierce · Status: Reference implementation (runnable) + spec
> Scope: The agentic harness for Distru, with "upload a product-catalog CSV" as the first use case.

This document is backed by a **working implementation** in this repo, not just prose. Where the spec says "the harness does X," there is code that does X, and a smoke test that exercises it. Read this alongside `README.md` (how to run) and the `lib/` tree.

---

## 1. Context & goals

Distru is a seed-to-sale ERP for licensed cannabis operators. We are building an **agentic harness** that will eventually power two products:

1. **Automated workflows** - cron/webhook-triggered automations across Distru + connected tools (QuickBooks, Metrc, Drive…).
2. **A Cowork-style chat copilot** - users ask questions and perform one-off actions; the copilot uses the Distru MCP plus the customer's other MCP servers.

The exercise's first use case is: **"a customer uploads a CSV of their product catalog and it just works,"** where the file is in an unpredictable, per-customer format and can be 100 to 10,000+ rows.

Rather than build a one-off CSV importer, this implementation builds the **harness** the importer rides on, so the same substrate powers chat today and workflows tomorrow. To make the design decisions real (and testable), the repo also implements the slice of Distru the harness acts on - **we are Distru** here: a multitenant catalog/inventory core, a Distru-API-faithful public API, an MCP server, and signed webhooks.

**Design thesis: one service layer, many faces.** A single org-scoped domain/service layer is the source of truth. Everything else is a thin adapter over it. Adding a capability = one service function + thin wrappers on each face. This is what makes the harness durable as scope grows.

---

## 2. Architecture

```mermaid
flowchart TD
    subgraph Faces
      Chat[Chat Copilot UI]
      REST[Public REST API /public/v1/*]
      MCP[MCP server /api/mcp]
      Bulk[/upload-products bulk engine/]
      WF[Workflows - cron/webhook  *future*]
    end
    subgraph Harness
      Runner[Agent runner: stream loop + HITL gate + resume]
      Registry[Tool registry]
      Ctx[AgentContext / ServiceCtx  - org-scoped]
    end
    subgraph Services
      P[products] --- I[inventory] --- R[reference] --- IM[imports] --- T[tokens] --- W[webhooks] --- A[audit]
    end
    DB[(Postgres · Drizzle · UUIDv7 · multitenant)]

    Chat --> Runner --> Registry --> Ctx --> Services --> DB
    REST --> Services
    MCP --> Services
    Bulk --> IM
    WF -.-> Runner
    Services --> W
```

**Stack:** Next.js 16 (App Router) + React 19, TypeScript, Tailwind v4, deployable to Vercel. Postgres via Drizzle (`postgres.js` driver - portable local↔Neon). Auth + multitenancy via **better-auth** + organization plugin. Agent via the **Anthropic SDK** (`claude-opus-5`, adaptive thinking, streaming). Chat UI uses **lucide-react** + **streamdown** (streaming markdown). Everything is **UUIDv7** end to end (auth rows and domain rows share one keyspace).

Why these choices:

- **One language, one deploy target.** Next on Vercel means the agent loop, the REST API, the MCP server, and the UI live in one codebase with one auth story.
- **Service layer over the DB, not over HTTP.** The chat tools call service functions directly (no internal HTTP hop), so the agent is fast and transactional; the REST/MCP faces call the *same* functions. There is exactly one place that knows how to create a product.
- **Manual streaming agent loop** (not the SDK tool-runner) because human-in-the-loop needs to *pause a turn mid-stream, persist, and resume across a stateless serverless invocation* - control the tool-runner doesn't expose.

---

## 3. The agentic harness (the centerpiece)

### 3.1 Tool contract (`lib/harness/tool.ts`)

Every capability is a self-describing tool:

```ts
type HarnessTool<I> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;          // → JSON Schema for Claude via z.toJSONSchema
  gate: "none" | "confirmation" | "question";
  buildPreview?(input, ctx): HarnessToolPreview;   // the Approve/Reject or question card
  execute(input, ctx, extra?): Promise<ToolResult>;
};
```

Tools are registered in a registry (`lib/harness/registry.ts`); `toAnthropicTools()` derives the Claude tool schemas from the Zod schemas. **Adding a capability is adding a tool** - nothing else in the loop changes.

### 3.2 Tenant-scoped context

`AgentContext` carries `{ service: {orgId, actor, actorType}, userId, conversationId, emit }`. Every tool runs against `service`, so **multitenancy is enforced at the tool boundary** - a tool physically cannot read another org's rows. The same `ServiceCtx` shape is built by the REST API (`actorType: "api"`), MCP (`"api"`), imports (`"import"`), and a future workflow (`"system"`), so the audit trail attributes every mutation to whoever caused it.

### 3.3 The runner (`lib/harness/runner.ts`)

A manual streaming loop over `client.messages.stream`:

1. Load conversation history from Postgres → `MessageParam[]`.
2. Stream an assistant turn; emit NDJSON events (`token`, `thinking`, `tool_start`, `tool_input`, `tool_result`, `interrupt`, `error`, `done`) to the client.
3. On `tool_use`: execute **non-gated** tools immediately; for **gated** tools, build a preview, persist the call as `pending`, and emit an `interrupt` that terminates the turn.
4. Feed non-gated results back and loop until `end_turn` (capped at 16 steps).

Persistence is first-class: messages are stored as raw Anthropic content blocks (so a turn replays verbatim, including thinking blocks bound to the model), and every tool call is a `tool_calls` row with input/output/status/decision - this is both the chat history and the **audit trail**.

### 3.4 Human-in-the-loop (concrete, serverless-safe)

Mutating tools (`gate: "confirmation"`) and `ask_user` (`gate: "question"`) never auto-run. The mechanism:

- **Trigger:** the runner sees a gated `tool_use`, calls `buildPreview(input, ctx)` (e.g. a create-product diff, or a validation summary), writes a `pending` `tool_calls` row, emits `interrupt`, and **closes the stream**. No partial `tool_result` is sent, so the assistant turn is left open exactly as Anthropic requires.
- **Who can act:** any member of the conversation's org; the decision + actor are recorded on the `tool_calls` row.
- **Resume:** the client `POST`s decisions to `/api/conversations/[id]/resume`. The server rebuilds the message history, and for **every** `tool_use` in the last assistant turn produces a `tool_result` - reusing stored output for already-executed tools, executing approved mutations now, writing "user declined" for rejects, and passing the answer through for `ask_user`. It appends one combined `tool_result` user message and re-enters the loop. Fully resumable across stateless invocations; nothing lives in server memory between turns.

`ask_user` is a distinct gate (not a mutation) so the model can get a structured decision mid-task - "Category 'Edibles' doesn't exist, create it?" - with typed options, without a plain-text guess.

Verified in this repo: mutation → interrupt with preview → **approve** writes the row (checked in Postgres); **reject** returns "user declined" and the model adapts.

### 3.5 Trigger-agnostic by construction

`runConversationTurn` is just "chat trigger → build AgentContext → run loop." A future **workflow** trigger builds the same context with a service actor and runs the same tools. The harness has no idea whether a human or a cron fired it. That is the whole point of the design.

### 3.6 Tools beyond our own (external MCP servers)

The brief's copilot uses the Distru MCP *plus the customer's own connected MCP servers* (QuickBooks, Sage, Metrc, Google Drive/Sheets, Calendar). The registry is built for exactly that: a tool is just `{ name, description, inputSchema, gate, execute }`, so tools sourced from an external MCP server register alongside the built-ins and inherit the **same gate/preview/audit** wrapper - a QuickBooks `create_invoice` would show the same Approve card as our `create_product`, and land in the same audit log. What's implemented here is the internal registry and our own MCP *server* (so others can drive Distru); the deferred piece is the MCP *client* that discovers a customer's connected servers and registers their tools. This is also what powers cross-tool **workflows** - e.g. the brief's "lab COA email → attach the PDF in Drive → mark the Distru inventory ready for sale" is just that same loop with an email trigger and tools from three MCP servers.

---

## 4. The product-import capability (flagship)

Built as a **generic import framework** (so it scales to other CSV types), not a product-only script.

### 4.1 The `ImportTarget` seam (`lib/imports/target.ts`)

```ts
type ImportTarget<Prep, Value> = {
  key; label; description;
  fields: CanonicalField[];            // canonical schema + aliases + enums + fk kinds
  prepare(ctx): Promise<Prep>;         // load reference caches ONCE per run
  validateRow(mapped, prep): ValidateResult<Value>;   // pure, per-row
  commitRows(rows, ctx, prep): Promise<{productId?}[]>;
};
```

Five targets are registered today and all ride the same pipeline: **products** (upsert catalog), **customers** and **vendors/distributors** (CRM companies), **price-list** (update prices by SKU), and **inventory-count** (set on-hand by SKU). Adding one is a single file - mapping, detection, validation, partial commit, and the error CSV all work for it with **zero pipeline changes**. That is the answer to "how does this scale to other CSVs?" - and it's why the agent can say *"I think this is a distributor list / price sheet / inventory count - what do you want to do with it?"* about a file it's never seen.

### 4.2 The pipeline (`lib/imports/pipeline.ts`)

The agent **orchestrates**; deterministic code does the heavy lifting. The model never sees more than headers + ~20 sample rows. The upload is **target-agnostic** - the agent detects what the file is and asks the user what to do, rather than assuming "products."

1. **Upload** (`POST /api/imports`) - parse CSV/XLSX (`papaparse` / `xlsx`), persist the file, headers, a sample, and **every row** to `import_rows` (rows live in Postgres, never in the LLM context). Returns a `job_id`.
1b. **Detect + confirm intent** (`detect_import_target` → `ask_user` → `set_import_target`) - `scoreTargets(headers)` ranks every registered target by how well its canonical fields match the columns (e.g. a customer list scores 100% on `customers`, 15% on `products`). The agent then asks *"This looks like a customer list - import as customers, as products, or something else?"* with concrete options, and retargets the job to whatever the user chooses. This is the "throw any CSV in and have a real conversation about it" flow, and it's what makes the framework's multi-target design visible to the user.
2. **Map** (`propose_column_mapping`) - a deterministic alias/fuzzy matcher produces a baseline; Claude refines it for the long tail (weird headers, sample-value inference), and falls back to the baseline if the model is unavailable. Result is an editable `ColumnMapping` stored on the job. `set_column_mapping` applies user corrections.
3. **Validate** (`validate_import`) - chunked (500 rows). Each row → `validateRow`: required fields, enum/number coercion (`"$3.25"`→`3.25`, `"grams"`→Gram), unknown-unit rejection, and **new-reference detection** (categories/vendors that would be created). Returns an **aggregate** summary (valid/warn/error counts, top error reasons, new references) - never raw rows.
4. **Confirm + commit** (`commit_import`, gated) - upserts valid + warning rows **by SKU** in chunks; **partial success** (error rows are skipped, not fatal). Re-derives the validated value from the persisted mapped row, so nothing extra is stored.
5. **Error report** (`get_error_report`) - a **row-mapped error CSV** (`_row`, original columns, `_errors`) downloadable in chat, mirroring Distru's real bulk-upload behavior.

The same commit engine is exposed directly as `POST /upload-products` (the internal endpoint the exercise references) for exact-template files and API callers.

### 4.3 Scale (100 → 10,000+ rows)

Rows are persisted and processed in chunks with progress; validate/commit are O(rows) with O(1) LLM calls (mapping only). In this repo, chunked processing runs in-process within Vercel's `maxDuration`. **For >10k rows and for the future "scan this Google Sheet nightly" workflow, the documented production path is a queue** (QStash/Inngest) that drives the exact same `validateImport`/`commitImport` chunk functions - no rewrite, because the pipeline is already chunked and job-backed.

---

## 5. Faithful Distru clone (why it's credible)

Modeled directly on Distru's real surface (`apidocs.distru.dev`, `mcp.distru.com`, the bulk-upload help center):

- **Product schema:** inventory tracking method (`PACKAGE|PRODUCT|BATCH`), name, unique SKU, category, vendor/brand (a CRM company), unit type (fixed singular set), unit price, net qty / serving fields, custom fields.
- **Public API conventions:** `Authorization: Bearer` tokens (SHA-256 hashed at rest); UUID ids; **numbers serialized as strings** (`"25.000000"`); microsecond ISO-8601 datetimes; uppercase enums; nulls always present; `page[number]` pagination with `next_page`; `{ errors: [{ message, pointer }] }`; **sparse upsert** (omit id→create, include→update, omit field→leave); **HMAC-signed webhooks** (`x-distru-signature: sha256=…`) with `CREATE/UPDATE/DELETE`.
- **MCP server** (`/api/mcp`, Streamable-HTTP JSON-RPC) exposing `distru-search-products`, `distru-get-product`, `distru-create-product`, `distru-adjust-inventory`, `distru-list-categories` - so an *external* agent can drive Distru, the mirror image of our own copilot.

All of these are implemented and were exercised with `curl` during development (see `README.md` → Verify).

In production the harness's product tools would call Distru's real MCP/API; here they call the service layer directly because this repo *is* Distru. The tool contract is identical either way, so swapping the backing call is a per-tool change, not a harness change.

---

## 6. Edge cases & product decisions (with rationale)

| Decision | Choice | Why |
|---|---|---|
| Arbitrary CSV columns | LLM mapping **seeded by** a deterministic matcher, with fallback | Deterministic handles the 80% cheaply and works offline; the LLM handles the long tail; fallback means an API blip degrades, not breaks. |
| File that's ambiguous or matches nothing | A deterministic classifier returns **confident / ambiguous / none**. The agent never auto-picks: it confirms on confident, **asks** on ambiguous, and **refuses** on none ("this doesn't map to any supported type - here's what I can import") without importing anything. | On real inventory, a wrong guess is worse than a question. Required-field coverage gates viability; a close runner-up forces a choice. |
| Model context vs. 10k rows | Rows live in Postgres; the model sees headers + sample + **aggregate** summaries | Correctness, cost, and scale. The agent orchestrates; it never ingests the dataset. |
| Validation failures | **Partial success** + row-mapped error CSV | Matches Distru; a customer with 9,850 good rows shouldn't be blocked by 150 bad ones. |
| Unknown category/vendor | Not an error - flagged as a "new reference" in the summary; created on commit (or gated via `ask_user` when there are many) | Onboarding files routinely introduce new brands/categories; forcing pre-creation defeats "it just works." |
| Unknown **unit type** | Hard error | Units are a fixed, compliance-relevant set; silently inventing one is wrong. |
| Duplicate SKU (in file or vs. existing) | Upsert by SKU (last wins / updates) | Re-uploading a corrected file must be safe and idempotent, never duplicate. |
| Prices like `"$3.25"`, `"1,200"` | Coerced; non-numeric like `"twenty"` → error | Real files are messy; obvious coercions should succeed, ambiguous ones should fail loudly. |
| Any data mutation | Confirmation gate (Approve/Reject) before execution | This is an ERP mutating real inventory; the confirmation card *is* the ask - the model shouldn't ask twice in prose. |
| Destructive actions (archive) | Gate marked `risk: high` | Visual weight matches consequence. |
| Multitenancy | `organization_id` on every row + tenant-scoped `ServiceCtx` at the tool boundary | Isolation is structural, not per-query discipline. |
| Auth id type | UUIDv7 for auth **and** domain rows | "UUIDs all the way around"; time-sortable primary keys; one keyspace for clean FKs. |

---

## 7. MVP vs. deferred

**MVP (built and runnable in this repo):**

- Multitenant auth + org onboarding; auto-seeded demo tenant.
- Product/category/company/location/inventory domain + service layer + audit log.
- Agentic harness: streaming loop, tool registry, HITL confirmation + `ask_user`, resumable across invocations, full persistence.
- CSV/XLSX import end-to-end: **target auto-detection (confident / ambiguous / none) → "what do you want to do with this?" (`ask_user`) → retarget** → LLM mapping → chunked validation → partial commit → row-mapped error CSV. **Five live targets** (`products`, `customers`, `vendors`, `price-list`, `inventory-count`) prove the generic framework - the same upload, detected and routed to the right one.
- Distru-faithful public REST API (products/companies/categories/stock-adjustments), MCP server, `/upload-products`, HMAC webhooks.
- App shell modeled on Distru's real modules: **Dashboard** (KPIs, module grid, live activity feed from the audit log), **Copilot** (streaming chat, tool cards, confirm/question cards, CSV upload), **Inventory**, **Companies** (CRM), and **Integrations** (mint tokens, API/MCP/webhook snippets). Sales Orders / Purchasing / Manufacturing / Compliance / Analytics are shown as honest "Preview" modules - the harness + service layer + public API/MCP are built to power them next.

**Deferred (specced; seams already in place):**

- Queue-backed processing for >10k rows and cron/webhook-triggered **workflows** (same chunk functions, different trigger).
- **MCP-client ingestion** of the customer's connected servers (Distru MCP + QuickBooks/Sage/Metrc/Drive/Sheets) into the tool registry - the copilot's full multi-MCP tool surface and the workflows' cross-tool actions. The registry + gate/preview/audit wrapper are already the seam for it (§3.6).
- More import targets (purchase orders, sales orders); full public-API parity (orders/invoices/assemblies).
- Webhook retry/backoff + a delivery-inspector UI; Vercel Blob for large source files.
- RBAC beyond org membership; per-tenant model/effort tuning; an **eval harness** for column-mapping accuracy (the one place I'd invest next, since mapping quality is the product).

---

## 8. Security & multitenancy notes

- Every domain row is `organization_id`-scoped; the `ServiceCtx` is the only way in, and it is always org-bound.
- API tokens are stored as SHA-256 hashes; the plaintext (`dk_live_…`) is shown once.
- Webhooks are HMAC-SHA256 signed with a per-endpoint secret.
- The agent cannot mutate data without a human decision (confirmation gate), and every mutation - from any face - is written to `audit_log` with the actor.

---

## 9. How to evaluate this

`README.md` has the run + verify steps. The fastest read on correctness is `npm run smoke`, which drives the service layer and the full import pipeline (messy CSV → map → validate → partial commit → error CSV) against Postgres with no LLM spend, and mints an API token for exercising the REST/MCP/bulk faces with `curl`.
