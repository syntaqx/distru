import { nodeSpec } from "./catalog";
import {
  type Connections,
  type WorkflowGraph,
  type WorkflowNode,
  isSubNode,
  isTrigger,
} from "./types";

export type GraphIssue = { level: "error" | "warning"; message: string };

/**
 * Validate a graph for executability. Errors block a run; warnings are surfaced
 * but do not. Kept intentionally forgiving - the canvas and the AI author both
 * produce graphs incrementally, so we flag real problems rather than nitpick.
 */
export function validateGraph(graph: WorkflowGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));

  const triggers = graph.nodes.filter((n) => isTrigger(n.type));
  if (triggers.length === 0) {
    issues.push({ level: "error", message: "Add a trigger node - a workflow needs a starting point." });
  }
  if (triggers.length > 1) {
    issues.push({ level: "warning", message: "Multiple triggers found; each is a separate entry point." });
  }

  const agents = graph.nodes.filter((n) => n.type === "agent");
  for (const a of agents) {
    const instruction = String((a.params as { instruction?: string }).instruction ?? "").trim();
    if (!instruction) {
      issues.push({ level: "error", message: `Agent "${a.name}" has no instruction.` });
    }
  }

  for (const n of graph.nodes) {
    if (!nodeSpec(n.type)) {
      issues.push({ level: "error", message: `Unknown node type "${n.type}".` });
    }
    if (n.type === "action" && !String((n.params as { tool?: string }).tool ?? "").trim()) {
      issues.push({ level: "error", message: `Action "${n.name}" has no tool selected.` });
    }
    if (n.type === "tool" && !String((n.params as { tool?: string }).tool ?? "").trim()) {
      issues.push({ level: "warning", message: `Tool node "${n.name}" has no tool selected.` });
    }
  }

  // Referential integrity of connections.
  for (const [source, byKind] of Object.entries(graph.connections)) {
    if (!ids.has(source)) {
      issues.push({ level: "warning", message: `Connection from an unknown node ${source}.` });
      continue;
    }
    for (const ports of Object.values(byKind)) {
      for (const port of ports ?? []) {
        for (const ep of port) {
          if (!ids.has(ep.node)) {
            issues.push({ level: "warning", message: `Connection to an unknown node ${ep.node}.` });
          }
        }
      }
    }
  }

  return issues;
}

export function graphErrors(graph: WorkflowGraph): GraphIssue[] {
  return validateGraph(graph).filter((i) => i.level === "error");
}

/**
 * Coerce arbitrary JSON (from the DB, the API, or the AI author) into a
 * well-formed graph: fill missing params from the catalog default, give nodes
 * positions, and drop malformed connection entries. Never throws.
 */
export function normalizeGraph(input: unknown): WorkflowGraph {
  const raw = (input ?? {}) as Partial<WorkflowGraph>;
  const nodes: WorkflowNode[] = Array.isArray(raw.nodes)
    ? raw.nodes
        .filter((n): n is WorkflowNode => !!n && typeof (n as WorkflowNode).id === "string")
        .map((n, i) => {
          const spec = nodeSpec(n.type);
          return {
            id: n.id,
            type: n.type,
            name: typeof n.name === "string" && n.name ? n.name : spec?.label ?? n.type,
            params: { ...(spec?.defaults ?? {}), ...(n.params ?? {}) },
            position:
              n.position && typeof n.position.x === "number"
                ? n.position
                : { x: 80 + (i % 4) * 280, y: 80 + Math.floor(i / 4) * 200 },
          };
        })
    : [];

  const connections: Connections = {};
  const rawConns = (raw.connections ?? {}) as Connections;
  for (const [source, byKind] of Object.entries(rawConns)) {
    if (!byKind || typeof byKind !== "object") continue;
    const clean: Connections[string] = {};
    for (const [kind, ports] of Object.entries(byKind)) {
      if (!Array.isArray(ports)) continue;
      clean[kind as keyof Connections[string]] = ports.map((port) =>
        Array.isArray(port) ? port.filter((ep) => ep && typeof ep.node === "string") : [],
      );
    }
    connections[source] = clean;
  }

  return { nodes, connections };
}

/** A brand-new graph: a single manual trigger, ready to build from. */
export function emptyGraph(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: "trigger.manual",
        name: "Manual trigger",
        params: {},
        position: { x: 80, y: 160 },
      },
    ],
    connections: {},
  };
}

export { isSubNode, isTrigger };
