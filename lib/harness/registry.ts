import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = import("./tool").HarnessTool<any>;

const registry = new Map<string, AnyTool>();

export function registerTool(tool: AnyTool) {
  registry.set(tool.name, tool);
}

export function registerTools(tools: AnyTool[]) {
  for (const t of tools) registerTool(t);
}

export function getTool(name: string): AnyTool | undefined {
  return registry.get(name);
}

export function allTools(): AnyTool[] {
  return [...registry.values()];
}

/** Convert registered tools into Anthropic tool definitions (JSON Schema). */
export function toAnthropicTools(): Anthropic.Tool[] {
  return allTools().map((tool) => {
    const schema = z.toJSONSchema(tool.inputSchema, {
      target: "draft-2020-12",
    }) as Record<string, unknown>;
    delete schema["$schema"];
    if (schema.type !== "object") {
      // Anthropic tool inputs must be objects.
      return {
        name: tool.name,
        description: tool.description,
        input_schema: { type: "object", properties: {} },
      } as Anthropic.Tool;
    }
    return {
      name: tool.name,
      description: tool.description,
      input_schema: schema as Anthropic.Tool.InputSchema,
    };
  });
}

export function gateFor(name: string) {
  return getTool(name)?.gate ?? "none";
}
