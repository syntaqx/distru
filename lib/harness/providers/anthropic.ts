import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { hasAnthropicKey } from "@/lib/env";
import type { HarnessEvent } from "../types";
import type { ModelProvider, ModelTurn, ModelTurnRequest, ModelToolSpec } from "./types";

/** Map our neutral tool specs to Anthropic's tool shape. */
function toAnthropicTools(tools: ModelToolSpec[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema:
      (t.inputSchema as Anthropic.Tool.InputSchema | undefined)?.type === "object"
        ? (t.inputSchema as Anthropic.Tool.InputSchema)
        : { type: "object", properties: {} },
  }));
}

/**
 * The native Anthropic provider. Streams with adaptive thinking and prompt
 * caching on the system prompt, the tuned defaults this harness was built for.
 */
export const anthropicProvider: ModelProvider = {
  id: "anthropic",
  model: MODEL,
  isConfigured: hasAnthropicKey,

  async streamTurn(
    req: ModelTurnRequest,
    emit: (event: HarnessEvent) => void,
  ): Promise<ModelTurn> {
    const stream = anthropic.messages.stream({
      model: req.model || MODEL,
      max_tokens: req.maxTokens ?? 16000,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      thinking: { type: "adaptive", display: "summarized" },
      tools: toAnthropicTools(req.tools),
      messages: req.messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          emit({ type: "tool_start", toolUseId: event.content_block.id, name: event.content_block.name });
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") emit({ type: "token", text: delta.text });
        else if (delta.type === "thinking_delta") emit({ type: "thinking", text: delta.thinking });
        else if (delta.type === "input_json_delta")
          emit({ type: "tool_input", toolUseId: "", partialJson: delta.partial_json });
      }
    }

    const final = await stream.finalMessage();
    const toolUses = final.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
    return {
      content: final.content as Anthropic.ContentBlockParam[],
      stopReason: final.stop_reason,
      toolUses,
    };
  },
};
