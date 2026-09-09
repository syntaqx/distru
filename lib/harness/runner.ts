import type Anthropic from "@anthropic-ai/sdk";
import {
  appendMessage,
  getToolCall,
  loadMessages,
  recordToolCall,
  toMessageParams,
  updateToolCall,
} from "@/lib/harness/conversations";
import { getConversation } from "@/lib/harness/conversations";
import type { AgentContext } from "./tool";
import { getTool, toolSpecs } from "./registry";
import { getModelProvider } from "./providers";
import { ensureToolsRegistered } from "./tools";
import { buildSystemPrompt } from "./system-prompt";
import type { Interrupt, ToolDecision } from "./types";
import type { ToolResult } from "./tool";

const MAX_STEPS = 16;

/**
 * Per-turn options. `toolNames` scopes the advertised tool set to a subset of the
 * registry - this is how an `agent` graph node runs with only its attached tools.
 * `model`/`maxSteps` let a node pin its model and step budget.
 */
export type RunOptions = {
  autoApprove?: boolean;
  toolNames?: string[];
  model?: string;
  maxSteps?: number;
};

function toolResultBlock(
  toolUseId: string,
  res: ToolResult,
): Anthropic.ToolResultBlockParam {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: JSON.stringify({ summary: res.summary, data: res.data ?? null }),
    is_error: !res.ok,
  };
}

async function systemPrompt(ctx: AgentContext) {
  const conv = await getConversation(ctx.service, ctx.conversationId);
  return buildSystemPrompt({
    orgName: conv?.title ? undefined : undefined,
    today: new Date().toISOString().slice(0, 10),
  });
}

/**
 * Run the agent loop until it finishes its turn (end_turn) or pauses for a human
 * decision (interrupt). `messages` must end with a user message.
 */
async function runLoop(
  ctx: AgentContext,
  messages: Anthropic.MessageParam[],
  opts: RunOptions = {},
) {
  const { autoApprove = false, toolNames, model } = opts;
  const system = await systemPrompt(ctx);

  const provider = getModelProvider();

  // Scope the advertised tools to a node's attached set, when given.
  const allowed = toolNames && toolNames.length ? new Set(toolNames) : null;
  const specs = allowed ? toolSpecs().filter((s) => allowed.has(s.name)) : toolSpecs();
  const maxSteps = opts.maxSteps ?? MAX_STEPS;

  for (let step = 0; step < maxSteps; step++) {
    let turn: Awaited<ReturnType<typeof provider.streamTurn>>;
    try {
      turn = await provider.streamTurn(
        { system, messages, tools: specs, model },
        (event) => ctx.emit(event),
      );
    } catch (err) {
      console.error("[runner] stream error", err);
      ctx.emit({
        type: "error",
        message: err instanceof Error ? err.message : "Model request failed.",
      });
      return;
    }

    // Persist + track the assistant turn.
    await appendMessage(ctx.service, ctx.conversationId, "assistant", turn.content);
    messages.push({ role: "assistant", content: turn.content });

    if (turn.stopReason !== "tool_use") {
      ctx.emit({ type: "done", stopReason: turn.stopReason });
      return;
    }

    const toolUses = turn.toolUses;
    const results: Anthropic.ToolResultBlockParam[] = [];
    const interrupts: Interrupt[] = [];

    for (const tu of toolUses) {
      const tool = getTool(tu.name);
      if (!tool) {
        const res: ToolResult = { ok: false, summary: `Unknown tool ${tu.name}.` };
        await recordToolCall(ctx.service, {
          conversationId: ctx.conversationId,
          toolUseId: tu.id,
          name: tu.name,
          inputJson: tu.input as Record<string, unknown>,
          status: "error",
          requiresConfirmation: false,
          output: res,
        });
        results.push(toolResultBlock(tu.id, res));
        continue;
      }

      if (allowed && !allowed.has(tu.name)) {
        const res: ToolResult = {
          ok: false,
          summary: `Tool ${tu.name} is not attached to this workflow node.`,
        };
        await recordToolCall(ctx.service, {
          conversationId: ctx.conversationId,
          toolUseId: tu.id,
          name: tu.name,
          inputJson: tu.input as Record<string, unknown>,
          status: "error",
          requiresConfirmation: false,
          output: res,
        });
        results.push(toolResultBlock(tu.id, res));
        continue;
      }

      if (tool.gate === "none") {
        let res: ToolResult;
        try {
          res = await tool.execute(tu.input, ctx);
        } catch (err) {
          res = {
            ok: false,
            summary: err instanceof Error ? err.message : "Tool failed.",
          };
        }
        await recordToolCall(ctx.service, {
          conversationId: ctx.conversationId,
          toolUseId: tu.id,
          name: tu.name,
          inputJson: tu.input as Record<string, unknown>,
          status: res.ok ? "auto" : "error",
          requiresConfirmation: false,
          output: res,
        });
        ctx.emit({
          type: "tool_result",
          toolUseId: tu.id,
          name: tu.name,
          ok: res.ok,
          summary: res.summary,
        });
        results.push(toolResultBlock(tu.id, res));
      } else if (autoApprove) {
        // Automated run (workflow/system trigger): no human is present, so
        // execute the gated tool immediately instead of pausing. The `ask_user`
        // tool gets a synthetic "proceed" answer.
        let res: ToolResult;
        try {
          res =
            tool.gate === "question"
              ? await tool.execute(tu.input, ctx, {
                  answer:
                    "This is an automated workflow run; no user is available. Proceed with your best judgment using safe defaults.",
                })
              : await tool.execute(tu.input, ctx);
        } catch (err) {
          res = {
            ok: false,
            summary: err instanceof Error ? err.message : "Tool failed.",
          };
        }
        await recordToolCall(ctx.service, {
          conversationId: ctx.conversationId,
          toolUseId: tu.id,
          name: tu.name,
          inputJson: tu.input as Record<string, unknown>,
          status: res.ok ? "auto" : "error",
          requiresConfirmation: true,
          output: res,
        });
        ctx.emit({
          type: "tool_result",
          toolUseId: tu.id,
          name: tu.name,
          ok: res.ok,
          summary: res.summary,
        });
        results.push(toolResultBlock(tu.id, res));
      } else {
        // Gated: record pending with a preview and defer execution to resume.
        const preview = tool.buildPreview
          ? await tool.buildPreview(tu.input, ctx)
          : {
              kind: "confirmation" as const,
              title: tool.name,
              summary: `Run ${tool.name}?`,
              fields: [],
            };
        await recordToolCall(ctx.service, {
          conversationId: ctx.conversationId,
          toolUseId: tu.id,
          name: tu.name,
          inputJson: tu.input as Record<string, unknown>,
          status: "pending",
          requiresConfirmation: true,
          preview,
        });
        interrupts.push({ toolUseId: tu.id, name: tu.name, preview });
      }
    }

    if (interrupts.length > 0) {
      // Pause the turn. Do NOT append tool results yet; resume will supply them.
      ctx.emit({ type: "interrupt", interrupts });
      return;
    }

    // All tools auto-ran: feed results back and continue the loop.
    await appendMessage(ctx.service, ctx.conversationId, "user", results);
    messages.push({ role: "user", content: results });
  }

  ctx.emit({ type: "done", stopReason: "max_steps" });
}

/** Entry point for a fresh user message (already persisted by the caller). */
export async function runConversationTurn(ctx: AgentContext, opts?: RunOptions) {
  ensureToolsRegistered();
  const rows = await loadMessages(ctx.service, ctx.conversationId);
  await runLoop(ctx, toMessageParams(rows), opts ?? {});
}

/**
 * Resolve pending human-in-the-loop tool calls and continue the turn. Builds one
 * tool_result message covering every tool_use of the last assistant turn, then
 * re-enters the loop.
 */
export async function resumeConversationTurn(
  ctx: AgentContext,
  decisions: ToolDecision[],
) {
  ensureToolsRegistered();
  const rows = await loadMessages(ctx.service, ctx.conversationId);
  const params = toMessageParams(rows);
  const lastAssistant = [...params].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant || !Array.isArray(lastAssistant.content)) {
    ctx.emit({ type: "error", message: "Nothing to resume." });
    return;
  }
  const toolUses = (lastAssistant.content as Anthropic.ContentBlockParam[]).filter(
    (b): b is Anthropic.ToolUseBlock => (b as { type: string }).type === "tool_use",
  );
  const byId = new Map(decisions.map((d) => [d.toolUseId, d]));

  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const tu of toolUses) {
    const record = await getToolCall(ctx.service, tu.id);
    if (record && (record.status === "auto" || record.status === "executed" || record.status === "error")) {
      // Already executed (non-gated) - reuse stored output.
      const stored = (record.output as ToolResult) ?? {
        ok: record.status !== "error",
        summary: "(no output)",
      };
      results.push(toolResultBlock(tu.id, stored));
      continue;
    }

    const decision = byId.get(tu.id);
    const tool = getTool(tu.name);
    if (!decision || !tool) {
      const res: ToolResult = { ok: true, summary: "User declined this action." };
      await updateToolCall(ctx.service, tu.id, {
        status: "rejected",
        decision: "reject",
        output: res,
        decidedBy: ctx.userId ?? null,
        decidedAt: new Date(),
      });
      results.push(toolResultBlock(tu.id, res));
      continue;
    }

    if (decision.decision === "reject") {
      const res: ToolResult = {
        ok: true,
        summary: `User declined this action${decision.reason ? `: ${decision.reason}` : ""}.`,
        data: { declined: true },
      };
      ctx.emit({ type: "tool_result", toolUseId: tu.id, name: tu.name, ok: true, summary: res.summary });
      await updateToolCall(ctx.service, tu.id, {
        status: "rejected",
        decision: "reject",
        output: res,
        decidedBy: ctx.userId ?? null,
        decidedAt: new Date(),
      });
      results.push(toolResultBlock(tu.id, res));
      continue;
    }

    // approve or answer → execute now.
    let res: ToolResult;
    try {
      res = await tool.execute(
        record?.input ?? tu.input,
        ctx,
        decision.decision === "answer" ? { answer: decision.value } : undefined,
      );
    } catch (err) {
      res = { ok: false, summary: err instanceof Error ? err.message : "Tool failed." };
    }
    ctx.emit({ type: "tool_result", toolUseId: tu.id, name: tu.name, ok: res.ok, summary: res.summary });
    await updateToolCall(ctx.service, tu.id, {
      status: res.ok ? "executed" : "error",
      decision: decision.decision,
      output: res,
      decidedBy: ctx.userId ?? null,
      decidedAt: new Date(),
    });
    results.push(toolResultBlock(tu.id, res));
  }

  await appendMessage(ctx.service, ctx.conversationId, "user", results);
  const refreshed = toMessageParams(await loadMessages(ctx.service, ctx.conversationId));
  await runLoop(ctx, refreshed);
}
