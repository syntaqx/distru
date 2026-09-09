import type { ServiceCtx } from "@/lib/modules/shared";
import { getTool } from "../registry";
import { ensureToolsRegistered } from "../tools";
import { createConversation, appendMessage } from "../conversations";
import { runConversationTurn } from "../runner";
import type { AgentContext } from "../tool";
import type { HarnessEvent } from "../types";
import {
  type AgentParams,
  type ActionParams,
  type Connections,
  type IfOp,
  type IfParams,
  type NodeRun,
  type TransformParams,
  type WorkflowGraph,
  type WorkflowNode,
  isTrigger,
} from "./types";

export type GraphRunResult = {
  status: "success" | "error";
  summary: string;
  nodeRuns: NodeRun[];
  /** The base conversation for the run (action/if/transform steps narrate here). */
  conversationId: string;
};

type RunContext = {
  trigger: Record<string, unknown>;
  nodes: Record<string, unknown>;
};

/** Resolve `{{ path.to.value }}` templates against the shared run context. */
function interpolate(template: string, rc: RunContext): string {
  if (typeof template !== "string" || !template.includes("{{")) return template;
  return template.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_m, path: string) => {
    const parts = path.replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean);
    let cur: unknown = rc;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return "";
      }
    }
    return cur == null ? "" : typeof cur === "string" ? cur : JSON.stringify(cur);
  });
}

/** Deep-interpolate string leaves of an arbitrary JSON value (for action inputs). */
function interpolateDeep(value: unknown, rc: RunContext): unknown {
  if (typeof value === "string") return interpolate(value, rc);
  if (Array.isArray(value)) return value.map((v) => interpolateDeep(v, rc));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolateDeep(v, rc)]),
    );
  }
  return value;
}

function evalCondition(op: IfOp, left: string, right: string): boolean {
  const nl = Number(left);
  const nr = Number(right);
  const numeric = !Number.isNaN(nl) && !Number.isNaN(nr);
  switch (op) {
    case "eq":
      return left === right;
    case "ne":
      return left !== right;
    case "gt":
      return numeric ? nl > nr : left > right;
    case "lt":
      return numeric ? nl < nr : left < right;
    case "gte":
      return numeric ? nl >= nr : left >= right;
    case "lte":
      return numeric ? nl <= nr : left <= right;
    case "contains":
      return left.includes(right);
    case "exists":
      return left.trim() !== "";
    case "truthy":
      return left.trim() !== "" && left !== "false" && left !== "0";
    default:
      return false;
  }
}

/** For an agent node, gather the tools/model attached via ai_* connections. */
function attachments(agentId: string, graph: WorkflowGraph, byId: Map<string, WorkflowNode>) {
  const tools: string[] = [];
  let model: string | undefined;
  for (const [sourceId, byKind] of Object.entries(graph.connections)) {
    const src = byId.get(sourceId);
    if (!src) continue;
    const targetsAgent = (kind: keyof Connections[string]) =>
      (byKind[kind] ?? []).some((port) => port.some((ep) => ep.node === agentId));
    if (src.type === "tool" && targetsAgent("ai_tool")) {
      const t = String((src.params as { tool?: string }).tool ?? "").trim();
      if (t) tools.push(t);
    }
    if (src.type === "model" && targetsAgent("ai_model")) {
      const m = String((src.params as { model?: string }).model ?? "").trim();
      if (m) model = m;
    }
  }
  return { tools, model };
}

function mainTargets(nodeId: string, port: number, graph: WorkflowGraph): string[] {
  const ports = graph.connections[nodeId]?.main ?? [];
  return (ports[port] ?? []).map((ep) => ep.node);
}

/**
 * Execute a workflow graph. Starts at a trigger, walks `main` connections in
 * flow order, running each node once. Agent nodes run the harness scoped to
 * their attached tools (auto-approving, since unattended); action/if/transform
 * nodes run deterministically. Returns per-node results for the run record.
 */
export async function runGraph(
  ctx: ServiceCtx,
  graph: WorkflowGraph,
  opts: {
    workflowName: string;
    triggerNodeId?: string;
    triggerData?: Record<string, unknown>;
    emit?: (event: HarnessEvent) => void;
  },
): Promise<GraphRunResult> {
  ensureToolsRegistered();
  const emit = opts.emit ?? (() => {});
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const base = await createConversation(ctx, {
    userId: null,
    title: `Workflow: ${opts.workflowName}`,
  });

  const rc: RunContext = { trigger: opts.triggerData ?? {}, nodes: {} };
  const nodeRuns: NodeRun[] = [];
  let hadError = false;

  // Seed the queue with the trigger's downstream nodes.
  const trigger =
    (opts.triggerNodeId ? byId.get(opts.triggerNodeId) : null) ??
    graph.nodes.find((n) => isTrigger(n.type));
  const visited = new Set<string>();
  const queue: string[] = trigger ? mainTargets(trigger.id, 0, graph) : [];

  const record = (
    node: WorkflowNode,
    status: NodeRun["status"],
    summary: string | null,
    conversationId: string | null,
    startedAt: string,
  ) => {
    nodeRuns.push({
      nodeId: node.id,
      type: node.type,
      name: node.name,
      status,
      summary,
      conversationId,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  };

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) continue;

    const startedAt = new Date().toISOString();
    let nextPort = 0;

    try {
      if (node.type === "agent") {
        const p = node.params as AgentParams;
        const { tools, model } = attachments(node.id, graph, byId);
        const conv = await createConversation(ctx, {
          userId: null,
          title: `${opts.workflowName} · ${node.name}`,
        });
        const instruction = interpolate(p.instruction ?? "", rc).trim();
        await appendMessage(ctx, conv.id, "user", [
          {
            type: "text",
            text:
              `[Automated workflow node: "${node.name}"]\n\n${instruction}\n\n` +
              `[System: unattended run - take the actions needed, then finish with a short summary.]`,
          },
        ]);

        let text = "";
        let actionCount = 0;
        let nodeError: string | null = null;
        await runConversationTurn(
          {
            service: ctx,
            userId: null,
            conversationId: conv.id,
            emit: (e) => {
              if (e.type === "token") text += e.text;
              else if (e.type === "tool_result") {
                if (e.ok) actionCount += 1;
                text = "";
              } else if (e.type === "error") nodeError = e.message;
              emit(e);
            },
          },
          {
            autoApprove: true,
            toolNames: tools.length ? tools : undefined,
            model: model || (p.model ?? undefined),
            maxSteps: typeof p.maxSteps === "number" ? p.maxSteps : undefined,
          },
        );

        if (nodeError) throw new Error(nodeError);
        const summary =
          text.trim().slice(0, 600) ||
          `Completed with ${actionCount} action${actionCount === 1 ? "" : "s"}.`;
        rc.nodes[node.id] = { summary, actionCount, conversationId: conv.id };
        record(node, "success", summary, conv.id, startedAt);
      } else if (node.type === "action") {
        const p = node.params as ActionParams;
        const tool = getTool(p.tool);
        if (!tool) throw new Error(`Unknown tool "${p.tool}".`);
        const input = interpolateDeep(p.input ?? {}, rc) as Record<string, unknown>;
        const agentCtx: AgentContext = {
          service: ctx,
          userId: null,
          conversationId: base.id,
          emit,
        };
        // Unattended: execute regardless of gate (the run itself is the approval).
        const res = await tool.execute(input, agentCtx, { answer: "Proceed with safe defaults." });
        rc.nodes[node.id] = { summary: res.summary, data: res.data ?? null };
        record(node, res.ok ? "success" : "error", res.summary, null, startedAt);
        if (!res.ok) hadError = true;
      } else if (node.type === "if") {
        const p = node.params as IfParams;
        const left = interpolate(p.left ?? "", rc);
        const right = interpolate(p.right ?? "", rc);
        const truthy = evalCondition(p.op ?? "truthy", left, right);
        nextPort = truthy ? 0 : 1;
        rc.nodes[node.id] = { branch: truthy ? "true" : "false" };
        record(node, "success", `Branch: ${truthy ? "true" : "false"}`, null, startedAt);
      } else if (node.type === "transform") {
        const p = node.params as TransformParams;
        const out: Record<string, string> = {};
        for (const a of p.assignments ?? []) {
          if (a?.key) out[a.key] = interpolate(a.value ?? "", rc);
        }
        rc.nodes[node.id] = out;
        record(node, "success", `Set ${Object.keys(out).length} value(s)`, null, startedAt);
      } else {
        // triggers/sub-nodes reached in the main flow are no-ops
        record(node, "skipped", null, null, startedAt);
      }
    } catch (err) {
      hadError = true;
      const message = err instanceof Error ? err.message : "Node failed.";
      record(node, "error", message, null, startedAt);
      continue; // stop this branch; other branches still run
    }

    for (const target of mainTargets(node.id, nextPort, graph)) {
      if (!visited.has(target)) queue.push(target);
    }
  }

  const status: GraphRunResult["status"] = hadError ? "error" : "success";
  const lastAgent = [...nodeRuns].reverse().find((r) => r.type === "agent" && r.summary);
  const summary =
    lastAgent?.summary ??
    (status === "error"
      ? nodeRuns.find((r) => r.status === "error")?.summary ?? "A node failed."
      : `Ran ${nodeRuns.length} node${nodeRuns.length === 1 ? "" : "s"}.`);

  return { status, summary, nodeRuns, conversationId: base.id };
}
