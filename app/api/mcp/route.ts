import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/modules/platform";
import type { ServiceCtx } from "@/lib/modules/shared";
import { callMcpTool, listMcpTools } from "@/lib/harness/mcp-bridge";

/**
 * Distru MCP server (Streamable HTTP, JSON-RPC 2.0). Lets an EXTERNAL agent
 * drive our platform - the mirror image of our own copilot. Auth via Bearer API
 * token, same as the public REST API.
 *
 * The tool surface is NOT hand-written here: it is derived from the same harness
 * tool registry the internal Copilot runs, via lib/harness/mcp-bridge.ts. Define a
 * capability once (as a HarnessTool) and it appears on both faces automatically.
 */

const SERVER_INFO = { name: "distru-mcp", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-06-18";

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status },
  );
}

export async function POST(req: Request) {
  const token = await verifyBearerToken(req.headers.get("authorization"));
  const body = (await req.json().catch(() => null)) as {
    jsonrpc?: string;
    id?: unknown;
    method?: string;
    params?: Record<string, unknown>;
  } | null;
  if (!body || body.jsonrpc !== "2.0")
    return rpcError(body?.id ?? null, -32600, "Invalid Request");

  const { id, method, params } = body;

  // Notifications (no id) get a 202.
  if (method === "notifications/initialized") return new Response(null, { status: 202 });

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }

  if (method === "tools/list") {
    return rpcResult(id, { tools: listMcpTools() });
  }

  if (method === "tools/call") {
    if (!token) return rpcError(id, -32001, "Unauthorized: provide a Bearer API token", 401);
    const ctx: ServiceCtx = {
      orgId: token.orgId,
      actor: `mcp:${token.tokenId}`,
      actorType: "api",
    };
    const name = params?.name as string;
    const args = (params?.arguments as Record<string, unknown>) ?? {};
    try {
      const result = await callMcpTool(name, args, ctx);
      return rpcResult(id, {
        content: [
          { type: "text", text: JSON.stringify(result.data ?? result.summary) },
        ],
        isError: !result.ok,
      });
    } catch (err) {
      return rpcResult(id, {
        content: [
          { type: "text", text: err instanceof Error ? err.message : "tool error" },
        ],
        isError: true,
      });
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

export async function GET() {
  return NextResponse.json({
    server: SERVER_INFO,
    protocol: PROTOCOL_VERSION,
    transport: "streamable-http (JSON-RPC 2.0 over POST)",
    tools: listMcpTools().map((t) => t.name),
  });
}
