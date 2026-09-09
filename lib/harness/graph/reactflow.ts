import type { Edge, Node } from "@xyflow/react";
import type { ConnectionKind, NodeRun, WorkflowGraph, WorkflowNode } from "./types";

/**
 * Converters between our canonical n8n-shaped `{ nodes, connections }` graph and
 * React Flow's `{ nodes, edges }`. The graph is the source of truth at rest; the
 * canvas edits React Flow's shape and converts back on save. Pure + isomorphic
 * (client-safe): no server imports.
 */

export type RFNodeData = {
  node: WorkflowNode;
  run?: NodeRun | null;
  toolLabel?: string | null;
};

export function toReactFlow(graph: WorkflowGraph, runs?: NodeRun[]): {
  nodes: Node<RFNodeData>[];
  edges: Edge[];
} {
  const runByNode = new Map((runs ?? []).map((r) => [r.nodeId, r]));
  const nodes: Node<RFNodeData>[] = graph.nodes.map((n) => ({
    id: n.id,
    type: "automation",
    position: n.position,
    data: { node: n, run: runByNode.get(n.id) ?? null },
    // Sub-nodes are visually detached from the main flow; keep them draggable.
    draggable: true,
  }));

  const edges: Edge[] = [];
  for (const [source, byKind] of Object.entries(graph.connections)) {
    for (const [kind, ports] of Object.entries(byKind)) {
      (ports ?? []).forEach((port, portIndex) => {
        for (const ep of port) {
          const isMain = kind === "main";
          edges.push({
            id: `${source}:${kind}:${portIndex}:${ep.node}`,
            source: isMain ? source : source,
            target: ep.node,
            sourceHandle: isMain ? `main-${portIndex}` : "out",
            targetHandle: isMain ? "in" : kind,
            // ai_* attachments render as dashed, like n8n's sub-node wires.
            animated: !isMain,
            style: isMain ? undefined : { strokeDasharray: "4 4" },
          });
        }
      });
    }
  }
  return { nodes, edges };
}

export function fromReactFlow(nodes: Node<RFNodeData>[], edges: Edge[]): WorkflowGraph {
  const graphNodes: WorkflowNode[] = nodes.map((n) => ({
    ...n.data.node,
    position: n.position,
  }));

  const connections: WorkflowGraph["connections"] = {};
  const push = (source: string, kind: ConnectionKind, portIndex: number, target: string) => {
    const byKind = (connections[source] ??= {});
    const ports = (byKind[kind] ??= []);
    while (ports.length <= portIndex) ports.push([]);
    ports[portIndex].push({ node: target });
  };

  for (const e of edges) {
    const target = e.target;
    const th = e.targetHandle ?? "in";
    if (th === "in") {
      const portIndex = e.sourceHandle?.startsWith("main-")
        ? Number(e.sourceHandle.slice(5)) || 0
        : 0;
      push(e.source, "main", portIndex, target);
    } else if (th === "ai_tool" || th === "ai_model" || th === "ai_memory") {
      // Sub-node -> agent: the sub-node is the source, the agent the endpoint.
      push(e.source, th, 0, target);
    }
  }
  return { nodes: graphNodes, connections };
}
