import { anthropic, MODEL } from "@/lib/anthropic";
import { allTools } from "../registry";
import { ensureToolsRegistered } from "../tools";
import { NODE_CATALOG } from "./catalog";
import { normalizeGraph, graphErrors } from "./validate";
import type { WorkflowGraph } from "./types";

/** The JSON contract the model must emit, documented inline for the prompt. */
function authoringSystemPrompt(): string {
  ensureToolsRegistered();
  const tools = allTools()
    .map((t) => `  - ${t.name} (${t.gate}): ${t.description}`)
    .join("\n");
  const nodeTypes = NODE_CATALOG.map(
    (s) => `  - "${s.type}" — ${s.description}${s.mainOutputs === 2 ? " (two main outputs: [true, false])" : ""}`,
  ).join("\n");

  return `You design automation workflows as a node graph, in the style of n8n.

Output ONLY a JSON object of this exact shape (no prose, no code fences):
{
  "nodes": [
    { "id": "<unique-string>", "type": "<node type>", "name": "<short label>",
      "params": { ... }, "position": { "x": <number>, "y": <number> } }
  ],
  "connections": {
    "<sourceNodeId>": {
      "main":    [ [ { "node": "<targetId>" } ] ],
      "ai_tool": [ [ { "node": "<agentId>" } ] ]
    }
  }
}

Rules:
- Every workflow starts with exactly one trigger node (type starts with "trigger.").
- "connections" is keyed by the SOURCE node id. "main" is the data flow between steps.
- An "agent" node does work by calling tools. Attach each tool as a separate "tool" node
  whose params are { "tool": "<tool name>" }, connected TO the agent via an "ai_tool"
  connection (the tool node is the source, the agent id is the target).
- An "if" node has two main outputs: index 0 = true branch, index 1 = false branch.
- Lay nodes out left-to-right: triggers near x=80, each subsequent step +260 on x.
  Put tool sub-nodes BELOW their agent (higher y).
- Reference earlier results in text with {{ nodes.<nodeId>.summary }} or {{ trigger.<field> }}.

Available node types:
${nodeTypes}

Available tools (for "tool" and "action" nodes) — name (gate): description:
${tools}

Prefer read-only tools unless the task clearly requires a mutation. Keep it minimal and correct.`;
}

/**
 * Turn a plain-language description into a workflow graph. One structured model
 * call, then normalize + validate. Throws with the validation error if the model
 * produced something unrunnable.
 */
export async function generateGraph(prompt: string): Promise<WorkflowGraph> {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: authoringSystemPrompt(),
    messages: [{ role: "user", content: `Build a workflow for: ${prompt}` }],
  });

  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  const jsonStr = extractJson(text);
  if (!jsonStr) throw new Error("The model did not return a workflow.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("The model returned malformed workflow JSON.");
  }

  const graph = normalizeGraph(parsed);
  const errors = graphErrors(graph);
  if (errors.length) {
    throw new Error(`Generated workflow was invalid: ${errors.map((e) => e.message).join("; ")}`);
  }
  return graph;
}

/** Pull the first balanced {...} object out of a possibly fenced response. */
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === "{") depth++;
    else if (body[i] === "}") {
      depth--;
      if (depth === 0) return body.slice(start, i + 1);
    }
  }
  return null;
}
