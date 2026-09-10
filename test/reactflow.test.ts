import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { fromReactFlow, toReactFlow, type RFNodeData } from "@/lib/harness/graph/reactflow";
import type { NodeRun, WorkflowGraph } from "@/lib/harness/graph/types";

const graph: WorkflowGraph = {
  nodes: [
    { id: "t", type: "trigger.manual", name: "Start", params: {}, position: { x: 0, y: 0 } },
    { id: "a", type: "agent", name: "Agent", params: { instruction: "hi" }, position: { x: 200, y: 0 } },
    { id: "tool1", type: "tool", name: "Catalog", params: { tool: "catalog" }, position: { x: 200, y: 150 } },
  ],
  connections: {
    t: { main: [[{ node: "a" }]] },
    tool1: { ai_tool: [[{ node: "a" }]] },
  },
};

describe("toReactFlow", () => {
  it("maps every graph node to an 'automation' React Flow node, preserving id/position", () => {
    const { nodes } = toReactFlow(graph);
    expect(nodes).toHaveLength(3);
    expect(nodes.every((n) => n.type === "automation")).toBe(true);
    const agent = nodes.find((n) => n.id === "a")!;
    expect(agent.position).toEqual({ x: 200, y: 0 });
    expect(agent.data.node.name).toBe("Agent");
    expect(agent.draggable).toBe(true);
  });

  it("attaches matching run results to their node and null when absent", () => {
    const runs: NodeRun[] = [
      {
        nodeId: "a",
        type: "agent",
        name: "Agent",
        status: "success",
        summary: "done",
        startedAt: "2024-01-01T00:00:00Z",
        finishedAt: "2024-01-01T00:00:01Z",
      },
    ];
    const { nodes } = toReactFlow(graph, runs);
    expect(nodes.find((n) => n.id === "a")!.data.run?.status).toBe("success");
    expect(nodes.find((n) => n.id === "t")!.data.run).toBeNull();
  });

  it("builds a solid main edge with main/in handles", () => {
    const { edges } = toReactFlow(graph);
    const main = edges.find((e) => e.source === "t")!;
    expect(main.id).toBe("t:main:0:a");
    expect(main.target).toBe("a");
    expect(main.sourceHandle).toBe("main-0");
    expect(main.targetHandle).toBe("in");
    expect(main.animated).toBe(false);
    expect(main.style).toBeUndefined();
  });

  it("builds a dashed animated edge for ai_* sub-node attachments", () => {
    const { edges } = toReactFlow(graph);
    const aiEdge = edges.find((e) => e.source === "tool1")!;
    expect(aiEdge.id).toBe("tool1:ai_tool:0:a");
    expect(aiEdge.target).toBe("a");
    expect(aiEdge.sourceHandle).toBe("out");
    expect(aiEdge.targetHandle).toBe("ai_tool");
    expect(aiEdge.animated).toBe(true);
    expect(aiEdge.style).toEqual({ strokeDasharray: "4 4" });
  });
});

describe("fromReactFlow", () => {
  it("reconstructs main connections from source/target handles", () => {
    const nodes: Node<RFNodeData>[] = [
      { id: "t", type: "automation", position: { x: 0, y: 0 }, data: { node: graph.nodes[0] } },
      { id: "a", type: "automation", position: { x: 200, y: 0 }, data: { node: graph.nodes[1] } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "t", target: "a", sourceHandle: "main-0", targetHandle: "in" },
    ];
    const out = fromReactFlow(nodes, edges);
    expect(out.connections).toEqual({ t: { main: [[{ node: "a" }]] } });
  });

  it("respects the source output port index (if-node false branch is port 1)", () => {
    const nodes: Node<RFNodeData>[] = [
      { id: "if", type: "automation", position: { x: 0, y: 0 }, data: { node: graph.nodes[0] } },
      { id: "x", type: "automation", position: { x: 1, y: 0 }, data: { node: graph.nodes[1] } },
      { id: "y", type: "automation", position: { x: 2, y: 0 }, data: { node: graph.nodes[2] } },
    ];
    const edges: Edge[] = [
      { id: "e-true", source: "if", target: "x", sourceHandle: "main-0", targetHandle: "in" },
      { id: "e-false", source: "if", target: "y", sourceHandle: "main-1", targetHandle: "in" },
    ];
    const out = fromReactFlow(nodes, edges);
    expect(out.connections.if!.main).toEqual([[{ node: "x" }], [{ node: "y" }]]);
  });

  it("routes ai_* target handles as sub-node connections keyed by the source", () => {
    const nodes: Node<RFNodeData>[] = [
      { id: "tool1", type: "automation", position: { x: 0, y: 0 }, data: { node: graph.nodes[2] } },
      { id: "a", type: "automation", position: { x: 1, y: 0 }, data: { node: graph.nodes[1] } },
    ];
    const edges: Edge[] = [
      { id: "e", source: "tool1", target: "a", sourceHandle: "out", targetHandle: "ai_tool" },
    ];
    const out = fromReactFlow(nodes, edges);
    expect(out.connections).toEqual({ tool1: { ai_tool: [[{ node: "a" }]] } });
  });

  it("round-trips a graph through toReactFlow -> fromReactFlow", () => {
    const { nodes, edges } = toReactFlow(graph);
    const out = fromReactFlow(nodes, edges);
    expect(out.connections).toEqual(graph.connections);
    expect(out.nodes.map((n) => n.id).sort()).toEqual(["a", "t", "tool1"]);
  });
});
