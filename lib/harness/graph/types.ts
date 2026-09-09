/**
 * The workflow graph model - deliberately n8n-shaped.
 *
 * A workflow is a directed graph of typed **nodes** joined by **connections**.
 * This mirrors n8n's `{ nodes, connections }` document so the mental model is
 * familiar (and an import/export shim stays possible), with one differentiator:
 * for us an **agent** node - an LLM turn scoped to a slice of the tool registry -
 * is a first-class node, not one of 400. Deterministic `action` nodes and agent
 * nodes compose in the same graph, exactly like n8n mixes an "If" node with an
 * "AI Agent" node.
 *
 * Two deliberate deviations from n8n, both documented:
 *  - connections are keyed by stable node **id**, not by node name (names change).
 *  - our "tools" are registry entries, surfaced as `tool` sub-nodes attached to an
 *    agent via an `ai_tool` connection (the n8n AI Agent sub-node pattern).
 */

/** Main-flow nodes carry data forward; sub-nodes attach to an agent's ports. */
export type NodeType =
  // triggers (graph entry points)
  | "trigger.manual"
  | "trigger.schedule"
  | "trigger.webhook"
  | "trigger.event"
  // main-flow steps
  | "agent"
  | "action"
  | "if"
  | "transform"
  // sub-nodes (attach to an agent, never in the main flow)
  | "tool"
  | "model"
  | "memory";

/** How two nodes connect. `main` is data flow; `ai_*` are agent attachment ports. */
export type ConnectionKind = "main" | "ai_tool" | "ai_model" | "ai_memory";

export type WorkflowNode = {
  id: string;
  type: NodeType;
  name: string;
  /** Node-type-specific configuration; see NODE_CATALOG for the shape per type. */
  params: Record<string, unknown>;
  position: { x: number; y: number };
};

/** One connection endpoint (the downstream/attached node). */
export type ConnectionEndpoint = { node: string };

/**
 * n8n-shaped connection map, keyed by SOURCE node id. For each connection kind,
 * an array indexed by output port -> the list of endpoints on that port. `if`
 * nodes use `main[0]` for the true branch and `main[1]` for the false branch.
 * Sub-nodes are the source of their `ai_*` connection and the agent is the
 * endpoint (data flows sub-node -> agent), matching n8n.
 */
export type Connections = Record<
  string,
  Partial<Record<ConnectionKind, ConnectionEndpoint[][]>>
>;

export type WorkflowGraph = {
  nodes: WorkflowNode[];
  connections: Connections;
};

// ---- Per-node param shapes (advisory types; validated leniently at runtime) ----

export type ScheduleParams = { cron?: string; description?: string };
export type EventParams = { event?: string };
export type WebhookParams = { path?: string };
export type AgentParams = {
  instruction: string;
  /** Optional model id override; falls back to an attached `model` sub-node, then default. */
  model?: string;
  maxSteps?: number;
};
export type ToolParams = { tool: string };
export type ModelParams = { model: string };
export type ActionParams = { tool: string; input?: Record<string, unknown> };
export type IfOp = "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains" | "exists" | "truthy";
export type IfParams = { left?: string; op?: IfOp; right?: string };
export type TransformParams = { assignments?: { key: string; value: string }[] };

/** Result of executing one node, recorded on the run and fed to downstream nodes. */
export type NodeRun = {
  nodeId: string;
  type: NodeType;
  name: string;
  status: "success" | "error" | "skipped";
  summary: string | null;
  /** Present for agent nodes: the conversation whose transcript is the audit trail. */
  conversationId?: string | null;
  startedAt: string;
  finishedAt: string;
};

export const AI_KINDS: ConnectionKind[] = ["ai_tool", "ai_model", "ai_memory"];

export function isTrigger(type: NodeType): boolean {
  return type.startsWith("trigger.");
}

export function isSubNode(type: NodeType): boolean {
  return type === "tool" || type === "model" || type === "memory";
}
