import type { ConnectionKind, NodeType } from "./types";

/**
 * The palette: metadata for every node type. Drives the canvas palette + config
 * panel, and is serialized into the AI-authoring prompt so the model knows the
 * exact vocabulary it may emit. One source of truth for "what a node is."
 */
export type NodeSpec = {
  type: NodeType;
  label: string;
  /** UI grouping + a one-liner shown in the palette. */
  group: "Triggers" | "Steps" | "Sub-nodes";
  description: string;
  /** Which connection ports this node exposes as a SOURCE (outputs). */
  outputs: ConnectionKind[];
  /** Number of main output ports (>1 => branch node, e.g. if = [true, false]). */
  mainOutputs: number;
  /** For sub-nodes: which agent port they attach to. */
  attachesTo?: ConnectionKind;
  /** Default params when a fresh node is dropped. */
  defaults: Record<string, unknown>;
};

export const NODE_CATALOG: NodeSpec[] = [
  {
    type: "trigger.manual",
    label: "Manual trigger",
    group: "Triggers",
    description: "Runs when someone clicks Run now.",
    outputs: ["main"],
    mainOutputs: 1,
    defaults: {},
  },
  {
    type: "trigger.schedule",
    label: "Schedule",
    group: "Triggers",
    description: "Runs on a cron schedule.",
    outputs: ["main"],
    mainOutputs: 1,
    defaults: { cron: "0 8 * * *", description: "Every day at 8:00am" },
  },
  {
    type: "trigger.webhook",
    label: "Webhook",
    group: "Triggers",
    description: "Runs when an external system POSTs to a URL.",
    outputs: ["main"],
    mainOutputs: 1,
    defaults: { path: "" },
  },
  {
    type: "trigger.event",
    label: "On event",
    group: "Triggers",
    description: "Runs when a domain event fires (e.g. order.create).",
    outputs: ["main"],
    mainOutputs: 1,
    defaults: { event: "order.create" },
  },
  {
    type: "agent",
    label: "AI Agent",
    group: "Steps",
    description:
      "Describe a task in plain language; the agent plans and calls its attached tools to do it. Attach tools below.",
    outputs: ["main"],
    mainOutputs: 1,
    defaults: { instruction: "", maxSteps: 12 },
  },
  {
    type: "action",
    label: "Action",
    group: "Steps",
    description: "Runs one tool directly with fixed inputs - no LLM. A deterministic step.",
    outputs: ["main"],
    mainOutputs: 1,
    defaults: { tool: "", input: {} },
  },
  {
    type: "if",
    label: "If",
    group: "Steps",
    description: "Branches the flow: true output and false output.",
    outputs: ["main"],
    mainOutputs: 2,
    defaults: { left: "", op: "truthy", right: "" },
  },
  {
    type: "transform",
    label: "Set",
    group: "Steps",
    description: "Writes named values into the run context for later nodes to read.",
    outputs: ["main"],
    mainOutputs: 1,
    defaults: { assignments: [] },
  },
  {
    type: "tool",
    label: "Tool",
    group: "Sub-nodes",
    description: "A capability the agent may use. Attach to an AI Agent's tool port.",
    outputs: ["ai_tool"],
    mainOutputs: 0,
    attachesTo: "ai_tool",
    defaults: { tool: "" },
  },
  {
    type: "model",
    label: "Model",
    group: "Sub-nodes",
    description: "Pins which model the agent uses. Attach to an AI Agent's model port.",
    outputs: ["ai_model"],
    mainOutputs: 0,
    attachesTo: "ai_model",
    defaults: { model: "" },
  },
  {
    type: "memory",
    label: "Memory",
    group: "Sub-nodes",
    description: "Carries prior run context into the agent. Attach to an AI Agent's memory port.",
    outputs: ["ai_memory"],
    mainOutputs: 0,
    attachesTo: "ai_memory",
    defaults: {},
  },
];

const BY_TYPE = new Map(NODE_CATALOG.map((s) => [s.type, s]));

export function nodeSpec(type: NodeType): NodeSpec | undefined {
  return BY_TYPE.get(type);
}
