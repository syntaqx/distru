import type Anthropic from "@anthropic-ai/sdk";
import type { HarnessEvent } from "../types";

/**
 * The model-provider seam. The runner (loop, HITL gate, persistence, audit) is
 * provider-agnostic; everything model-specific lives behind this interface, so
 * swapping Anthropic for OpenAI (or any other) is one adapter + one env var and
 * changes nothing in the loop, the tools, or the conversation store.
 *
 * Canonical IR: we standardize on Anthropic's content-block message shape as the
 * harness's internal representation (text / tool_use / tool_result / thinking).
 * It is a clean superset, and it's what we already persist - so a provider that
 * speaks a different wire format (e.g. OpenAI chat messages) translates at ITS
 * edge, and the rest of the system never sees the difference.
 */

/** A tool as the model sees it: name, description, JSON Schema (draft 2020-12). */
export type ModelToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/** One assistant turn to generate: system prompt + block-shaped history + tools. */
export type ModelTurnRequest = {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: ModelToolSpec[];
  maxTokens?: number;
  /** Optional per-turn model override (e.g. an agent node pinning its model). */
  model?: string;
};

/** A parsed tool call the model wants to make. */
export type ModelToolUse = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

/** The completed assistant turn, normalized to canonical blocks. */
export type ModelTurn = {
  /** The assistant message content, in canonical block form (persisted as-is). */
  content: Anthropic.ContentBlockParam[];
  /** Why the model stopped; "tool_use" means it wants tools run. */
  stopReason: string | null;
  /** Tool calls parsed out of `content`, for the runner to gate/execute. */
  toolUses: ModelToolUse[];
};

export interface ModelProvider {
  /** Stable id, e.g. "anthropic" | "openai". */
  readonly id: string;
  /** The concrete model this provider is configured to call. */
  readonly model: string;
  /** True when the provider has the credentials it needs to run. */
  isConfigured(): boolean;
  /**
   * Stream one assistant turn, emitting token/thinking/tool events as they
   * arrive, and resolve to the completed, normalized turn.
   */
  streamTurn(
    req: ModelTurnRequest,
    emit: (event: HarnessEvent) => void,
  ): Promise<ModelTurn>;
}
