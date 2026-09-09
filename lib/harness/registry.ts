import { z } from "zod";
import type { ModelToolSpec } from "./providers/types";
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

/**
 * Convert registered tools into provider-neutral specs (name, description, JSON
 * Schema). Each model provider maps these into its own wire format, so the tool
 * definitions live in one place regardless of which model is driving them.
 */
export function toolSpecs(): ModelToolSpec[] {
  return allTools().map((tool) => {
    const schema = z.toJSONSchema(tool.inputSchema, {
      target: "draft-2020-12",
    }) as Record<string, unknown>;
    delete schema["$schema"];
    const inputSchema =
      schema.type === "object" ? schema : { type: "object", properties: {} };
    return {
      name: tool.name,
      description: tool.description,
      inputSchema,
    };
  });
}

export function gateFor(name: string) {
  return getTool(name)?.gate ?? "none";
}
