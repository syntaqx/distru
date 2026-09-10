---
title: "The take-home: brief & answer"
section: "Copilot & take-home"
summary: "The AI Product Engineer take-home, and how this project answers it."
keywords: ["take-home","takehome","instructions","brief","exercise","spec","harness","csv","import","answer","mvp","deferred","copilot"]
order: 110
---
# The take-home: brief & answer

Piece 2 exists to answer a specific prompt. This page states the brief and maps it to what was built; the mechanics live in [The agentic harness](/docs/harness) and [The import pipeline](/docs/import-pipeline).

## The brief

> Design Distru's **agentic harness**. It must eventually power two products: (1) **automated workflows** on a trigger, connecting to a customer's operational software, and (2) a **Cowork-style chat copilot** that performs one-off actions via the Distru MCP plus the customer's other MCP servers. Incorporate the first use case: **"a customer uploads a CSV of their product catalog and it just works"** - the file is in an unpredictable, per-customer format and can be 100 to 10,000+ rows.

The deliverable was a tech spec. This project is that spec **backed by a runnable implementation**: where the spec says "the harness does X," there is code that does X and a smoke test that exercises it.

## The answer, in one line

Rather than build a one-off CSV importer, build the **harness** the importer rides on - a trigger-agnostic agentic runtime over the modular platform - so the same substrate powers chat today and workflows tomorrow.

## How the brief maps to the build

| The brief asks for | The answer |
|---|---|
| An agentic **harness** | A tool registry + a manual streaming runner + a per-tenant `AgentContext`. A capability is a self-describing tool; adding one changes nothing in the loop. |
| **Human-in-the-loop** for real actions | A per-tool `gate` (`none` / `confirmation` / `question`). Gated tools pause the turn, persist a `pending` row, and **resume across a stateless invocation** - answerable minutes later by a different person. |
| Powers **workflows** *and* **chat** | `runConversationTurn(ctx, { autoApprove })`. Chat pauses for approval; an Automation runs the identical loop unattended. The runner has no idea whether a human or a cron fired it. |
| The customer's **other MCP servers** | A tool is just `{ name, description, inputSchema, gate, execute }`, so tools discovered from a connected MCP server register alongside the built-ins and inherit the same gate/preview/audit wrapper. |
| **"Throw any CSV in and it works"** | A generic import framework: **detect** the file type (confident / ambiguous / none), **map** arbitrary columns, **validate** every row, **partially commit** the good ones, and hand back a **row-mapped error CSV**. Seven file types, each one file. |
| **100 to 10,000+ rows** | Rows live in Postgres and are processed in chunks; the model only ever sees headers + ~20 sample rows + aggregates. Validate/commit are O(rows) with O(1) model calls. |

## What we built

The brief is a 3-4 hour design exercise; we answered it with a running system, and then took the design past the MVP line deliberately - to prove it holds across a whole ERP, not just one flow. What exists now is broad and deep:

- The **harness** - streaming loop, provider seam (Anthropic ↔ OpenAI env flip), per-tool HITL that pauses and resumes from Postgres, trigger-agnostic across chat and automations - driving **~80 tools across every domain**.
- **Transactional depth** - an on-hand ledger with transfers and scan, sales (orders → invoices → payments, returns/credits), purchasing, manufacturing (assemblies + scheduling), cultivation and grow (batches, harvests, packaging, COAs), compliance, logistics/deliveries, CRM notes, and tasks.
- **Five faces on one service layer** - the Copilot, a Distru-faithful **REST API of 150 self-documented routes** (build-time drift guard) with an interactive **API Reference explorer**, the **MCP server** exposing the full domain surface (65 tools), the bulk uploader, and HMAC webhooks.
- The **import pipeline** end-to-end with seven targets and 100 → 10,000+ rows.
- The **visual workflow engine** - node-graph automations with AI-agent nodes, real cron, and a produce → deliver → notify loop.
- The **integration ecosystem** - Metrc, QuickBooks, LeafLink, BioTrack, email, and Drive as API-accurate mocks behind a real, env-selected seam.

**The honest boundary:** the one thing that isn't real is **live** third-party sync - the external adapters run as mocks behind an interface a live one drops into, and stay labeled mocked. The remaining seams (a queue past 10k rows, a durable workflow runtime, MCP-*client* ingestion of a customer's own servers, RBAC beyond org membership) are adapters against boundaries that already exist. The one place worth investing next is an **eval harness for column-mapping accuracy**, because mapping quality is the actual product.

See [Decisions, scope and building](/docs/building) for the edge-case decisions and the order it was built in.
