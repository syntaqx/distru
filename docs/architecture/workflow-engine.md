---
title: "The workflow engine"
section: "Copilot & take-home"
summary: "The visual, n8n-shaped automation engine - an AI agent as a first-class node - and the produce -> deliver -> notify loop it powers."
keywords: ["workflow","automation","node graph","n8n","agent node","executor","react flow","canvas","cron","schedule","reports","artifacts","delivery","email","drive","notifications","generate_report","report registry"]
order: 112
---
# The workflow engine

The second product the harness must power is **automated workflows** - tasks that run on a trigger and connect a customer's operational software. We built that on the same [harness](/docs/harness): the runner is [trigger-agnostic](/docs/harness), so a workflow is just the same agent loop fired by a cron instead of a human, auto-approving because nobody is at the keyboard.

But an automation is more than "run one instruction unattended." It's a **directed graph of typed nodes** - the model [n8n](https://n8n.io) uses - with one twist that's ours: an **AI agent is a first-class node**.

## The graph model (`lib/harness/graph/`)

A workflow is `{ nodes, connections }`, deliberately **n8n-shaped** so the mental model transfers (and an import/export shim stays possible). `connections` is keyed by source node and, per kind, an array of output ports to endpoints. Two deliberate, documented deviations from n8n:

- Connections key on a stable node **id**, not name (names change).
- Our tools surface as **`tool` sub-nodes** attached to an agent via an `ai_tool` connection - the n8n AI-Agent sub-node pattern.

### Node types

- **Triggers** start a run: `manual` (Run now), `schedule` (a real cron), `webhook`, `event`.
- **Agent** - the first-class citizen. It runs the *same harness turn as chat*, scoped to exactly the `tool` sub-nodes wired into its port, auto-approving because unattended. Give it `inventory_report` + `save_report` and it builds and saves the report.
- **Action** - one tool with fixed inputs, no LLM. A deterministic step.
- **If** - a two-output branch (true / false).
- **Set** - writes values later nodes read via `{{ nodes.<id>.summary }}` / `{{ trigger.<field> }}` templates.

Deterministic and agentic nodes compose in one graph - exactly like n8n mixes an "If" node with an "AI Agent" node.

## The executor (`executor.ts`)

The executor walks `main` connections from the trigger in flow order, running each node once against a shared run-context that later nodes read through the `{{ ... }}` templates. Agent nodes get **their own conversation** (its transcript is that node's audit trail), and per-node results are recorded on the run. It's the ["trigger-agnostic by construction"](/docs/harness) claim made visual: the executor has no idea whether a human clicked **Run** or a cron fired the tick.

- A tiny standard-cron evaluator (`schedule.ts`) arms `nextRunAt`; a `tick` endpoint fires due workflows and re-arms them - so **scheduled triggers fire for real** (a platform cron hits the endpoint; the durable-runtime seam behind it is Inngest/Temporal in production).

## Authoring: canvas, prompt, or JSON

- A **React Flow** canvas edits the graph - drag nodes from a palette, wire a tool sub-node into an agent's tool port, configure each node in a side panel, **Run** and watch per-node status light up, then open **History** for the per-step transcript.
- Pure converters (`reactflow.ts`) map the canonical graph to React Flow's `{ nodes, edges }` and back (roundtrip-tested).
- **Generate** (`authoring.ts`) turns a plain-language prompt into a validated graph in one structured model call.
- A **Visual / JSON toggle** exposes the canonical `{ nodes, connections }` document directly - copy it to share an automation, paste one in to import it.

## Real-world outcomes: produce -> deliver -> notify

A workflow doesn't just print text - it does real work:

- **Produce.** An agent node calls `save_report` to persist its output as a durable **artifact** that lives in a [Reports](/docs/reports) section (rendered markdown, downloadable). `generate_report` snapshots one of the standard Insights reports the same way.
- **Deliver.** `email_report` and `upload_to_drive` push an artifact to an inbox or a Drive folder through `EmailProvider` / `DriveProvider` - the **outbound side of the integration seam** (mirroring the model seam), env-selected (`EMAIL_PROVIDER` / `DRIVE_PROVIDER`, default mock; `none` makes the tools honestly report "not connected - set it up in Settings -> Integrations").
- **Notify.** Every completed run drops an in-app **notification** (a `notifications` row) with a deep link to its results, surfaced on the topbar bell and a GitHub-style **Notifications** inbox (nav under Dashboard).

So the seeded low-stock automation becomes: *schedule -> agent (build + `save_report`) -> the report appears in Reports, is emailed / uploaded to Drive, and the bell links you straight to it.* This is the brief's lab-COA workflow - *"email arrives -> attach the PDF -> mark inventory ready"* - as the same loop with an email trigger and tools from a few MCP servers.

## One report registry ties Insights to Reports

The 24 standard analytical reports live in one **report registry** (`lib/modules/reports/insights-reports.ts`): a single definition (columns + `run(ctx)`) per report that is the sole source of truth for the public `/reports/*` API (each route collapses to a ~4-line factory call), the **Insights** UI list, *and* the `generate_report` tool. So an operator can hit **"Save to Reports"** on any Insights report to snapshot it as an artifact, and an automation can `generate_report("sales-by-product")` on a schedule and email the result - the numbers are guaranteed identical everywhere because there is one implementation.

## Why build it as a graph (decision + alternative)

The simpler MVP was "a saved instruction, run unattended" - and that's where automations started. The graph is deliberately more: it makes **AI steps compose with deterministic steps**, exposes the trigger/agent/tool model an operator can reason about, and - because agent-with-tools is a *native node* rather than one of 400 - keeps the differentiator (AI woven through the workflow) front and center. The cost is a real executor + canvas; the payoff is that "workflows connect all your operational software" becomes a graph you can see, share, and schedule, on the exact same harness that powers chat.
