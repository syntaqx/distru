import { z } from "zod";
import type { ServiceCtx } from "@/lib/modules/shared";
import type { AgentContext, HarnessTool, ToolResult } from "./tool";
import { catalogTools } from "./tools/catalog";
import { mutationTools } from "./tools/mutations";
import { inventoryTools } from "./tools/inventory";
import { salesTools } from "./tools/sales";
import { analyticsTools } from "./tools/analytics";
import { reportTools } from "./tools/reports";
import { cultivationTools } from "./tools/cultivation";
import { purchasingTools } from "./tools/purchasing";
import { manufacturingTools } from "./tools/manufacturing";
import { schedulingTools } from "./tools/scheduling";
import { complianceTools } from "./tools/compliance";
import { growTools } from "./tools/grow";
import { logisticsTools } from "./tools/logistics";
import { dispatchTools } from "./tools/dispatch";
import { crmTools } from "./tools/crm";
import { taskTools } from "./tools/tasks";
import { integrationTools } from "./tools/integrations";

/**
 * The MCP bridge: exposes the SAME harness tools the built-in Copilot uses to an
 * external MCP agent. A capability is defined once (as a HarnessTool) and shows
 * up on both faces automatically - add a tool and it is instantly drivable from
 * the chat copilot and from Claude Desktop / Cursor / any MCP client.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = HarnessTool<any>;

// The domain capabilities offered to external agents - the full operational
// surface across every module, mirroring (and exceeding) Distru's own MCP.
// Internal-only tools (docs search, the import job pipeline, automation/workflow
// management, ask_user) stay off the external surface because they need
// chat/session state.
const EXPOSED: AnyTool[] = [
  ...catalogTools,
  ...mutationTools,
  ...inventoryTools,
  ...salesTools,
  ...analyticsTools,
  ...reportTools,
  ...cultivationTools,
  ...purchasingTools,
  ...manufacturingTools,
  ...schedulingTools,
  ...complianceTools,
  ...growTools,
  ...logisticsTools,
  ...dispatchTools,
  ...crmTools,
  ...taskTools,
  ...integrationTools,
];

/** Harness tool name (`create_order`) → Distru MCP tool name (`distru-create-order`). */
function mcpName(toolName: string) {
  return `distru-${toolName.replace(/_/g, "-")}`;
}

/** Derive a JSON Schema for the tool's input from its Zod schema. */
function jsonSchema(tool: AnyTool): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.inputSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
  delete schema["$schema"];
  if (schema.type !== "object") return { type: "object", properties: {} };
  return schema;
}

/** The MCP `tools/list` payload, derived from the harness registry. */
export function listMcpTools() {
  return EXPOSED.map((tool) => ({
    name: mcpName(tool.name),
    description: tool.description,
    inputSchema: jsonSchema(tool),
  }));
}

const byMcpName = new Map(EXPOSED.map((t) => [mcpName(t.name), t] as const));

/**
 * Execute one MCP tool call against the org-scoped service. Input is validated by
 * the tool's own Zod schema. Mutating tools run directly: an external MCP agent is
 * its own human-in-the-loop, so this is the same `execute` the Copilot runs once a
 * human clicks Approve - the audit log still attributes it to the API token.
 */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  service: ServiceCtx,
): Promise<ToolResult> {
  const tool = byMcpName.get(name);
  if (!tool) return { ok: false, summary: `Unknown tool: ${name}` };
  const parsed = tool.inputSchema.safeParse(args ?? {});
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
      .join("; ");
    return { ok: false, summary: `Invalid arguments - ${detail}` };
  }
  const ctx: AgentContext = { service, userId: null, conversationId: "mcp", emit: () => {} };
  return tool.execute(parsed.data, ctx);
}
