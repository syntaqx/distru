---
title: "Model economics: scaling off frontier models"
section: "Copilot & take-home"
summary: "Why the architecture is already cost-optimized, and the concrete path from a frontier model to cheaper open-weight / self-hosted inference — an env flip, not a rewrite."
keywords: ["cost","economics","open source","open weight","self-hosted","vllm","tgi","llama","qwen","mistral","routing","fine-tune","distillation","qlora","quantization","batching","scaling","frontier","provider seam","skill file","instruction as config","sovereignty","compliance","human in the loop"]
order: 116
---
# Model economics: scaling off frontier models

The build runs on a frontier model (Claude, via `ANTHROPIC_MODEL`) because in a time-boxed build that's the fastest path to *correct* — best-in-class tool use and reasoning with zero tuning. But a seed-to-sale platform running imports and nightly workflows across thousands of tenants can't pay frontier per-token prices forever. This is the plan for taking the cost down **without a rewrite** — because the [provider seam](/docs/harness) already made the model a deployment knob, not an architectural commitment.

## The architecture is already the biggest cost lever

The cheapest token is the one you never send. The core import decision — [the agent orchestrates, deterministic code does the heavy lifting](/docs/import-pipeline) — means the model **never sees the rows**. On a 10,000-row file it sees the headers, a ~20-row sample, and column aggregates, then emits one column mapping. Validation and commit are pure Postgres.

**The model is the brain; the platform modules are the hands.** Its job is to understand what a file is and how its columns map, then hand off — the actual work (validate, dedupe, upsert, adjust inventory) runs as deterministic TypeScript against Postgres, never as tokens. That division is exactly what makes a *small* model viable: we're never asking it to reason through a 10k-row commit, only to make one bounded routing-and-mapping decision.

So model spend per import is **O(1), not O(rows)** — a few thousand tokens whether the file is 100 rows or 100,000. Most "AI import" cost blows up because teams stream the data through the model; here the expensive part is already off the model entirely. Everything below shrinks an already-small bill.

## Tier the work: a small model does most of it

Import work is mostly **bounded classification and mapping**, not open-ended reasoning:

- **detect the target** (products / price list / customers / none) — a classification.
- **map columns** to a known target schema — a constrained match against a fixed field set, with alias + fuzzy fallback already carrying part of the load.

These don't need a frontier model. A 7–8B open-weight model (Llama 3.1, Qwen2.5, Mistral) handles them well, especially once fine-tuned (below). Route by difficulty: the small model does detection and mapping; a larger (or frontier) model is reserved only for genuinely ambiguous files or free-form chat. A cheap model answering 90% of calls is where the ~50%+ savings that open-source deployments report actually come from — most calls simply stop hitting the expensive endpoint.

## Behavior lives in text, not in weights

The most cost-effective tuning lever isn't a training run — it's the instruction. How the model should behave (what a "products" file looks like, which target schemas exist, how to name a mapping, when to ask instead of guess) lives as structured text in the [tool contract and system preamble](/docs/harness), not baked into weights or scattered through code. This is the "SKILL file" paradigm: the model's playbook is a document you edit, so iteration is a text change, not an engineering project.

That matters economically two ways. **It's free** — refining the preamble costs zero compute and no retraining, so we can close accuracy gaps by editing instructions long before we ever pay for a fine-tune. And **iteration speed is the moat**: the team that revises its mapping instructions fifty times against real files in a week ends up with something a six-month fine-tune can't easily beat, because the feedback loop — not the model — is the advantage. Every improvement here also *reduces* the tokens and retries a weaker model needs, which is the same as lowering the bill.

## Self-hosting is an env var, by design

The provider seam standardizes on an OpenAI-compatible edge, and **vLLM and TGI both expose an OpenAI-compatible server**. So a self-hosted Llama or Qwen drops into the existing `openai` provider with only two env vars changed — **no new code**, same tools, same gates, same conversation store:

```bash
# Today (frontier):
# MODEL_PROVIDER=anthropic
# ANTHROPIC_MODEL=claude-opus-5

# Self-hosted swap: flip the provider, point it at a local vLLM server
MODEL_PROVIDER=openai
OPENAI_BASE_URL=http://vllm.internal:8000/v1
OPENAI_MODEL=Qwen2.5-7B-Instruct-AWQ      # served weights, quantized
OPENAI_API_KEY=local                      # any non-empty string for a local server
```

```bash
# The endpoint that URL points at — one command, OpenAI-compatible out of the box
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct-AWQ \
  --quantization awq \
  --max-model-len 8192 \
  --guided-decoding-backend outlines   # for constrained JSON, below
```

Options, cheapest-effort first:

1. **Hosted open-model APIs** (Together, Fireworks, Groq, DeepInfra) — open weights at a fraction of frontier pricing, still zero infra. Same swap, just their base URL and key. Usually the first step, because it de-risks the model choice before you provision a single GPU.
2. **Self-hosted inference** (vLLM / TGI on a rented or owned GPU) — past a volume threshold, amortized GPU cost beats per-token pricing outright. A single 24GB card (e.g. an A10/L4, ~$0.50–0.75/hr rented) serves a quantized 7B with continuous batching for many tenants at once. Nightly sheet-sync workflows are **latency-tolerant and batchable**, which is exactly where self-hosted batch inference is most economical: queue the day's syncs, run them through one saturated GPU, pay for wall-clock instead of per-token.

## Make the small model good, then gate the swap

- **Fine-tune / distill with QLoRA.** Once instructions alone plateau (~80–85% on bounded tasks), close the gap by fine-tuning. Log the frontier model's own accepted mappings as training data — every approved import is a labeled example — and **QLoRA** (4-bit base + low-rank adapters) tunes a 7B on 2k–5k of them in a few hours on one rented GPU (~$5 on RunPod/Lambda), or overnight on CPU. The research is settled here: the QLoRA paper's Guanaco reached ~99.3% of ChatGPT's quality on a single day of one-GPU training. On our bounded detect-and-map task that realistically lands at **≥90% accuracy** — and it's a one-time cost amortized across every tenant on that vertical's adapter, not a per-customer expense.
- **Squeeze tokens and throughput.** Quantization (**AWQ / GPTQ / FP8** — a 7B drops to ~4–5GB and runs on a single commodity GPU), **continuous batching** in vLLM so concurrent imports share the card, **prompt caching** for the stable system/tool preamble (it's identical every call, so it should be paid for once), and **constrained decoding** (`outlines` / vLLM guided decoding) that forces output to the mapping's JSON schema — a valid mapping on the first pass instead of a re-prompt loop, which is both correctness and a direct token saving.
- **Gate every model change on evals.** The one prerequisite — and the [deferred item I'd build first](/docs/building) — is a **mapping-accuracy eval harness**: score proposed mappings against a labeled fixture set (real headers → known-correct target mapping), report per-field precision/recall, and **block any model or prompt change that regresses** in CI. This is what makes every lever above safe to pull: you swap Opus for a tuned Qwen only when the harness proves the mapping quality held. You never swap a model on vibes when a wrong mapping corrupts a customer's inventory.

## The residual 10% is already handled

A small tuned model hits ~90% on bounded tasks, which means ~1 in 10 decisions is uncertain — and the honest answer to those is a human, not a bigger model. In most chatbot stacks that graceful handoff is something you have to bolt on. Here **it's already the architecture**: nothing the model proposes is written until a human clicks approve, and on a genuinely ambiguous file the [Copilot asks with concrete options instead of guessing](/docs/copilot). So the cost of running a cheaper, slightly-less-certain model is bounded by design — a wrong guess surfaces as a rejected card, never as corrupted inventory. We can tolerate a 90% model precisely because the human-in-the-loop gate was never optional.

## Sovereignty is a compliance dividend, not just a cost play

Self-hosting isn't only cheaper — for a [seed-to-sale platform holding licenses, COAs, and Metrc data](/docs/compliance) it's a regulatory posture. When inference runs on our own OpenAI-compatible endpoint, **no customer row, license number, or lab result ever leaves our infrastructure** to reach a third-party model provider. The same env-var swap that lowers the bill also removes an entire class of data-residency and vendor-processing questions from every compliance conversation. Cost and control move together, which is why the self-hosted endpoint is worth building even before the per-token math alone would demand it.

## What ships now vs. what's deferred

**Now (MVP):** frontier model behind the provider seam; per-call cost already minimized by keeping rows off the model, behavior already living in an editable preamble, and the human-in-the-loop gate already absorbing the residual. **Deferred, but designed for:** the eval harness (the gate), a QLoRA-tuned small model for detect + map, difficulty-based routing, and a self-hosted OpenAI-compatible endpoint for batch workflows and data sovereignty. None of these is a rewrite — each is an adapter, an env var, or a config change against seams that already exist. That's the whole point of paying the up-front cost of the provider seam: the day the model bill matters, lowering it is an operational decision, not an engineering project.

**The order of operations, cheapest first:** edit the instructions (free) → route the easy 90% to a hosted open model (fraction of frontier price) → fine-tune with QLoRA when instructions plateau (~$5, one time) → self-host on a batched GPU past the volume threshold (fixed cost, and sovereign). Every step is gated by the eval harness, and every step compounds — because the expensive part, streaming rows through a model, was designed out from the start.
