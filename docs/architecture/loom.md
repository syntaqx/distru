---
title: "Loom walkthrough script"
section: "Copilot & take-home"
summary: "The 5-10 minute video script - how I used AI, the key decisions with alternatives and tradeoffs, and what I did not get to."
keywords: ["loom","video","walkthrough","script","how i used ai","decisions","tradeoffs","alternatives","deliverable"]
order: 116
---

# Loom script — deliverable #2 (5–10 min)

A speak-from script for the walkthrough. Rough timings in brackets; talk to the points, don't read them verbatim. The three things the brief asks the Loom to cover — **how I used AI**, **key decisions + alternatives/tradeoffs**, and **what I didn't get to** — are called out inline.

---

## 0. Framing [~0:45]

> "Quick framing before I dig in. The brief asks for a tech spec plus this Loom, and it's explicit that the job is mostly *harness design*, which has no single right answer. So the deliverable is the spec — the **[Architecture & take-home](/docs/architecture)** docs.
>
> But I made one deliberate choice up front: instead of *describing* a harness, I **built a working one**, on a faithful clone of Distru, and pointed it at the CSV-import use case. Every claim in the spec is backed by running code and a smoke test. I did that to pressure-test the design — you find the real edges when you actually build it — and because a working artifact communicates convictions better than prose. I'll be explicit about the MVP line so the scope reads as judgment, not sprawl."

*(This is the most important 45 seconds — it turns "you over-built a 3–4h exercise" into "I built to de-risk the design, and here's the MVP boundary.")*

## 1. The core thesis [~1:00]

> "The thesis is one idea: **a modular platform, with a Copilot on top.**
>
> Piece 1 is the domain — bounded-context modules that are the single source of truth and have *zero* dependency on the AI. Piece 2 is the agentic harness layered over it. Chat, the public REST API, the MCP server, the bulk `/upload-products` engine, and workflows are all thin adapters over the *same* module functions. So there's exactly one place that knows how to create a product, and chat / API / imports can never disagree.
>
> The boundaries aren't a convention — they're **enforced by ESLint**: domain modules can't import the Copilot, and everyone imports a module's barrel, not its internals. That's what keeps it a modular monolith that stays extractable into services later."

**Decision + alternative:** *one service layer vs. a one-off CSV importer.* The importer would've been faster, but the brief says this harness has to grow into cross-tool workflows and a multi-MCP copilot — so I invested in the substrate, not the feature.

## 2. The harness — where the real design is [~1:30]

> "The centerpiece is the runner. Three decisions worth calling out:
>
> **One — a manual streaming loop, not the SDK tool-runner.** Human-in-the-loop needs to *pause a turn mid-stream, persist the pending tool call, and resume on a later, stateless serverless invocation.* The tool-runner doesn't expose that control, so I own the loop. A tool declares a **gate** — none, confirmation, or a structured `ask_user` question — and gated tools stop the turn, write a preview card, and wait; approval resumes exactly where it left off.
>
> **Two — trigger-agnostic by construction.** The runner has no idea whether a human or a cron fired it. The chat copilot and unattended automations call the *identical* loop; automations just run with auto-approve and attribute every action to the workflow in the audit log. That's the seam that lets the same harness power both products the brief names.
>
> **Three — a provider seam.** The loop, tools, HITL, and persistence never name a vendor; one adapter is the only model-specific code, so Anthropic↔OpenAI is an env flip. Same shape as the external-integration seams — Metrc, QuickBooks, email, Drive are all mock-by-default behind an interface a live adapter drops into."

**Decision + alternative:** *gate on the tool vs. a global confirm setting.* Per-tool gating means a read is instant and a mutation is always safe, with no caller having to remember to ask.

## 3. The product-import approach [~1:30]

> "Now the use case, and how it rides the harness. The insight: **the agent orchestrates; deterministic code does the heavy lifting.** The model *never* sees 10,000 rows — it sees the headers, a small sample, and aggregates. It decides *what* the file is and *how columns map*; a chunked pipeline in Postgres does validation and commit.
>
> The flow is **detect → ask → map → validate → partial-commit → error-CSV**:
> - **Detect** classifies the file — confident / ambiguous / none. A wrong guess on someone's real inventory is worse than a question, so on ambiguous it uses the `ask_user` gate — *'this looks like customers or vendors, which is it?'*
> - **Map** is LLM column-mapping against a target's canonical fields, with alias + fuzzy fallback.
> - **Validate + commit** are chunked and O(rows) with O(1) model calls; **9,850 good rows shouldn't be blocked by 150 bad ones**, so it partial-commits and hands back a row-mapped error CSV — mirroring Distru's real `/upload-products` behavior.
>
> And because it's a generic `ImportTarget` seam, adding a new type — price sheets, customer lists, inventory counts, sales orders — is a **single file**. That's the 'scan a Google Sheet nightly' future: same pipeline, different trigger."

**Edge cases I'll flag:** arbitrary/unmappable columns, unknown category or vendor (created on commit, gated when many), prices like `"$3.25"` (coerced; `"twenty"` is an error), duplicate SKUs (upsert, last wins), and the file that isn't products at all (it refuses instead of guessing).

## 4. Scale + faithfulness in one line each [~0:30]

> "Scale: rows live in `import_rows` in Postgres, processed in chunks within the serverless budget; past 10k the same chunk functions move behind a queue — no rewrite, because it's already job-backed. Faithfulness: the public API is field-accurate to Distru's real OpenAPI — 152 documented routes with a build-time drift guard, browsable in an in-app API Reference explorer — and the external systems run mocked in the demo behind a config-aware seam that switches to live adapters (OAuth/REST/SMTP) on real credentials, not faked inline."

## 5. MVP vs. deferred — the scope call [~0:45]

> "The **MVP** the brief asks for is: the harness (loop, HITL, resume, provider seam), the import capability end-to-end, and the faces that prove one service layer. I built well past that line on purpose — to show the design holds across a whole ERP, not one flow. What's there now is real breadth *and* depth: **~80 tools across every domain**, a transactional seed-to-sale core with a costed on-hand ledger, five faces on one service layer including a **150-route REST API** and an **MCP server exposing the full domain surface**, and the visual workflow engine on the same harness. That breadth is a demonstration, not scope creep — I'm clear about the line.
>
> **The one thing that isn't real is live third-party sync** — Metrc, QuickBooks, LeafLink, email, Drive all run as API-accurate mocks behind a real seam, and I label them mocked. The other seams — a durable workflow runtime behind the in-process executor, live webhook/event triggers (cron already fires), MCP-*client* ingestion of a customer's own connected servers, RBAC beyond org membership — are adapters against boundaries that already exist, not rewrites."

## 6. How I used AI [~0:45]

> "On process: I researched Distru's real API, MCP, and brand first so the clone would be faithful rather than invented. Then I used Claude Code to build and iterate — but the discipline was **verify each layer live**, not trust that it worked: curl every face with a real token, check the database, run an offline smoke test that drives the modules and the full import pipeline with no model spend. The AI moved fast; the verification is what makes the claims trustworthy."

## 7. What I didn't get to [~0:30]

> "What I'd do next, and would've covered with more time: an **eval harness for column-mapping accuracy** — mapping quality *is* the product, and that's where regression testing pays off immediately. Also the MCP-client side (ingesting a customer's other servers into the registry) and RBAC beyond org membership. And I'd tighten the spec's readability — it's thorough, and a reviewer's time isn't."

## 8. Close [~0:15]

> "So: a harness designed for two products and proven on one use case, with a clear MVP line and honest seams for the rest. The spec has the depth; happy to go deeper on any decision."

---

### Recording notes
- **~7 minutes** at a normal pace; drop §4 or trim §3's edge-case list if you're running long.
- Screen-share plan: the spec's diagram for §1–2; the running app for §3 (drop a messy CSV into the Copilot → the ask-user card → partial commit → error CSV); a quick **breadth** sweep for §5 (the costed seed-to-sale flow — plant batch → harvest → package with a COA → order → invoice → payment, on-hand moving through the ledger), then the **MCP** driving the same tools from an external client (`distru-*`), and the **Automations canvas** for the workflow engine.
- Lead with §0. If a reviewer only remembers one thing, make it "built to de-risk the design, here's the MVP line."
