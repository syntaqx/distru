import type Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { HarnessEvent } from "../types";
import type { ModelProvider, ModelTurn, ModelTurnRequest } from "./types";

/**
 * OpenAI (and any OpenAI-compatible endpoint) provider, implemented against the
 * Chat Completions streaming API with no extra dependency. It translates the
 * harness's canonical Anthropic-block messages to OpenAI's wire format and back,
 * so selecting it is purely `MODEL_PROVIDER=openai` + `OPENAI_API_KEY` - the
 * runner, tools, gates, and conversation store are untouched.
 *
 * Compile- and type-verified; exercise it at runtime by setting the env vars.
 */

type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

function blockText(blocks: Anthropic.ContentBlockParam[]): string {
  return blocks
    .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function stringifyToolResult(content: Anthropic.ToolResultBlockParam["content"]): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  return content
    .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
    .join("\n");
}

/** Canonical Anthropic-block history -> OpenAI chat messages. */
function toOpenAiMessages(system: string, messages: Anthropic.MessageParam[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: "system", content: system }];
  for (const m of messages) {
    const content = m.content;
    if (typeof content === "string") {
      out.push({ role: m.role === "assistant" ? "assistant" : "user", content });
      continue;
    }
    if (m.role === "assistant") {
      const toolCalls = content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          type: "function" as const,
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      out.push({
        role: "assistant",
        content: blockText(content) || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }
    // user turn: tool_result blocks become individual `tool` messages; any plain
    // text becomes a user message.
    for (const b of content) {
      if (b.type === "tool_result")
        out.push({ role: "tool", tool_call_id: b.tool_use_id, content: stringifyToolResult(b.content) });
    }
    const text = blockText(content);
    if (text) out.push({ role: "user", content: text });
  }
  return out;
}

type StreamedToolCall = { id: string; name: string; args: string };

export const openaiProvider: ModelProvider = {
  id: "openai",
  model: env.openaiModel,
  isConfigured: () => env.openaiApiKey.length > 0,

  async streamTurn(
    req: ModelTurnRequest,
    emit: (event: HarnessEvent) => void,
  ): Promise<ModelTurn> {
    const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: env.openaiModel,
        max_completion_tokens: req.maxTokens ?? 16000,
        stream: true,
        messages: toOpenAiMessages(req.system, req.messages),
        tools: req.tools.map((t) => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.inputSchema },
        })),
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`OpenAI request failed (${res.status}): ${await res.text().catch(() => "")}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let finish: string | null = null;
    const toolCalls: StreamedToolCall[] = []; // indexed by position

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        let chunk: {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
            };
            finish_reason?: string | null;
          }[];
        };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        if (choice.delta?.content) {
          text += choice.delta.content;
          emit({ type: "token", text: choice.delta.content });
        }
        for (const tc of choice.delta?.tool_calls ?? []) {
          const slot = (toolCalls[tc.index] ??= { id: "", name: "", args: "" });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name = tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
          if (slot.name && slot.id)
            emit({ type: "tool_start", toolUseId: slot.id, name: slot.name });
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
    }

    const content: Anthropic.ContentBlockParam[] = [];
    if (text) content.push({ type: "text", text });
    const toolUses = toolCalls
      .filter((t) => t.id && t.name)
      .map((t) => {
        let input: Record<string, unknown> = {};
        try {
          input = t.args ? JSON.parse(t.args) : {};
        } catch {
          input = {};
        }
        content.push({ type: "tool_use", id: t.id, name: t.name, input });
        return { id: t.id, name: t.name, input };
      });

    const stopReason =
      finish === "tool_calls" || toolUses.length
        ? "tool_use"
        : finish === "length"
          ? "max_tokens"
          : "end_turn";
    return { content, stopReason, toolUses };
  },
};
