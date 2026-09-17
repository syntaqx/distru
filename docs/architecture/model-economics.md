---
title: "Model economics: scaling off frontier models"
section: "Copilot & take-home"
summary: "Why the architecture is already cost-optimized, and the concrete path from a frontier model to cheaper open-weight / self-hosted inference — an env flip, not a rewrite."
keywords: ["cost","economics","open source","open weight","self-hosted","vllm","tgi","llama","qwen","mistral","routing","fine-tune","distillation","quantization","batching","scaling","frontier","provider seam"]
order: 116
---
# Model economics: scaling off frontier models

The build runs on a frontier model (Claude, via `ANTHROPIC_MODEL`) because in a time-boxed build that's the fastest path to *correct* — best-in-class tool use and reasoning with zero tuning. But a seed-to-sale platform running imports and nightly workflows across thousands of tenants can't pay frontier per-token prices forever. This is the plan for taking the cost down **without a rewrite** — because the [provider seam](/docs/harness) already made the model a deployment knob, not an architectural commitment.

## The architecture is already the biggest cost lever

The cheapest token is the one you never send. The core import decision — [the agent orchestrates, deterministic code does the heavy lifting](/docs/import-pipeline) — means the model **never sees the rows**. On a 10,000-row file it sees the headers, a ~20-row sample, and column aggregates, then emits one column mapping. Validation and commit are pure Postgres.

So model spend per import is **O(1), not O(rows)** — a few thousand tokens whether the file is 100 rows or 100,000. Most "AI import" cost blows up because teams stream the data through the model; here the expensive part is already off the model entirely. Everything below shrinks an already-small bill.

## Tier the work: a small model does most of it

Import work is mostly **bounded classification and mapping**, not open-ended reasoning:

- **detect the target** (products / price list / customers / none) — a classification.
- **map columns** to a known target schema — a constrained match against a fixed field set, with alias + fuzzy fallback already carrying part of the load.

These don't need a frontier model. A 7–8B open-weight model (Llama 3.1, Qwen2.5, Mistral) handles them well, especially once fine-tuned (below). Route by difficulty: the small model does detection and mapping; a larger (or frontier) model is reserved only for genuinely ambiguous files or free-form chat. A cheap model answering 90% of calls is where the ~50%+ savings that open-source deployments report actually come from — most calls simply stop hitting the expensive endpoint.

## Self-hosting is an env var, by design

The provider seam standardizes on an OpenAI-compatible edge, and **vLLM and TGI both expose an OpenAI-compatible server**. So a self-hosted Llama or Qwen drops into the existing `openai` provider with only `OPENAI_BASE_URL` (and the model name) changed — **no new code**, same tools, same gates, same conversation store. Options, cheapest-effort first:

1. **Hosted open-model APIs** (Together, Fireworks, Groq, DeepInfra) — open weights at a fraction of frontier pricing, still zero infra. Usually the first step.
2. **Self-hosted inference** (vLLM / TGI on a rented or owned GPU) — past a volume threshold, amortized GPU cost beats per-token pricing outright. Nightly sheet-sync workflows are **latency-tolerant and batchable**, which is exactly where self-hosted batch inference is most economical.

## Make the small model good, then gate the swap

- **Fine-tune / distill.** Label a corpus of real column-mapping decisions (and distill from the frontier model's own outputs) to fine-tune the small model on *our* schema. Mapping quality is the product, so this is where tuning pays back fastest.
- **Squeeze tokens and throughput.** Quantization (AWQ / GPTQ / FP8), continuous batching, prompt caching for the stable system/tool preamble, and **constrained decoding** so the mapping comes back as guaranteed-valid JSON instead of being re-prompted.
- **Gate every model change on evals.** The one prerequisite — and the [deferred item I'd build first](/docs/building) — is a **mapping-accuracy eval harness**: score proposed mappings against labeled fixtures and block any model or prompt change that regresses. You never swap a model on vibes when a wrong mapping corrupts a customer's inventory.

## What ships now vs. what's deferred

**Now (MVP):** frontier model behind the provider seam; per-call cost already minimized by keeping rows off the model. **Deferred, but designed for:** the eval harness (the gate), a small fine-tuned model for detect + map, difficulty-based routing, and a self-hosted OpenAI-compatible endpoint for batch workflows. None of these is a rewrite — each is an adapter or a config change against seams that already exist. That's the whole point of paying the up-front cost of the provider seam: the day the model bill matters, lowering it is an operational decision, not an engineering project.
