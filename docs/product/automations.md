---
title: "Automations"
section: "Copilot"
summary: "Build workflows as a node graph - AI agents, triggers, and actions that produce and deliver real reports, on a schedule."
keywords: ["automation","automations","workflow","workflows","node graph","canvas","agent","schedule","scheduled","cron","trigger","webhook","run now","unattended","recurring","job","report","email","drive"]
order: 7
---
# Automations

An **automation** is a workflow you build as a **node graph** - triggers, AI agents, conditions, and deterministic actions wired together. It follows the n8n model, but an **AI agent is a first-class node**: describe a task in plain language and it plans and calls the tools you give it, right alongside ordinary no-LLM steps.

## The building blocks
- **Triggers** start a run: **Manual** (Run now), **Schedule** (a cron - fires for real), **Webhook**, or **On event**.
- **AI Agent** - an unattended Copilot turn scoped to exactly the **Tool** sub-nodes you wire into it. Give it `inventory_report` + `save_report` and it builds and saves the report.
- **Action** - runs a single tool with fixed inputs, no LLM. A deterministic step.
- **If** - branches the flow (a true path and a false path).
- **Set** - writes values that later steps read via `{{ nodes.<id>.summary }}`.

## Build one
Open **Automations** and either:
- **Draw it on the canvas** - drag nodes from the palette, wire a Tool sub-node into an agent's tool port, and edit each node in the side panel.
- **Generate it** - click **Generate** and describe the automation (*"every weekday at 8am, list products under 25 units and email me the report"*); the AI drafts the whole graph for you to edit.
- **Ask the Copilot** - *"Save an automation that flags every SKU under 10 units each morning"* and approve the card.

Prefer JSON? Toggle **Visual / JSON** to edit the graph document directly - copy it to hand an automation to someone, or paste one in to import it.

## Run and review
**Run** executes the graph and lights up each node's status live. Open **History** for every run, its per-step breakdown, and each agent step's full transcript (the tool calls plus the rendered report). **Scheduled** triggers fire on their cron automatically.

## Real outcomes: produce, deliver, notify
Automations don't just print text - they do real work:
- **save_report** persists the output as a durable **[Report](/docs/reports)** you can view and download.
- **email_report** / **upload_to_drive** deliver that report to an inbox or Google Drive (through the [integrations](/docs/integrations) seam).
- Every completed run drops a **notification** on the topbar bell and the **Notifications** inbox, linking straight to its results.

## Unattended + audited
A chat asks you to approve each change; an automation runs **unattended** and auto-approves its own actions - so write instructions that stand on their own (name the thresholds, the products, and what you want back). Every action is still written to the audit log, attributed to the automation. Review what one does before scheduling it to run repeatedly.
