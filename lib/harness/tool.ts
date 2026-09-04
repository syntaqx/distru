import type { z } from "zod";
import type { ServiceCtx } from "@/lib/services/context";
import type { HarnessEvent, HarnessToolPreview } from "./types";

/** Streaming + tenant context handed to every tool. */
export type AgentContext = {
  service: ServiceCtx;
  userId: string | null;
  conversationId: string;
  /** Emit a streaming event to the client (no-op in non-streaming contexts). */
  emit: (event: HarnessEvent) => void;
};

export type ToolResult = {
  ok: boolean;
  /** Short human/model-facing summary of what happened. */
  summary: string;
  /** Structured payload returned to the model as JSON. */
  data?: unknown;
};

/**
 * How a tool is gated before execution:
 *  - "none": auto-executes.
 *  - "confirmation": mutating; pauses the turn for Approve/Reject.
 *  - "question": ask_user; pauses the turn for a structured answer.
 */
export type ToolGate = "none" | "confirmation" | "question";

export type HarnessTool<I = Record<string, unknown>> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  gate: ToolGate;
  /** Build the Approve/Reject or question card shown to the human. */
  buildPreview?: (
    input: I,
    ctx: AgentContext,
  ) => HarnessToolPreview | Promise<HarnessToolPreview>;
  /**
   * Execute the tool. For gated tools this runs only after approval; `answer`
   * carries the user's response for the ask_user (question) gate.
   */
  execute: (
    input: I,
    ctx: AgentContext,
    extra?: { answer?: string },
  ) => Promise<ToolResult>;
};

/** Identity helper that preserves the input type through inference. */
export function defineTool<I>(tool: HarnessTool<I>): HarnessTool<I> {
  return tool;
}

export type { ServiceCtx };
