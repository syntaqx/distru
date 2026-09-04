import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/services/tokens";
import type { ServiceCtx } from "@/lib/services/context";
import {
  createProduct,
  getProductBySku,
  listProducts,
} from "@/lib/services/products";
import {
  findOrCreateCategory,
  findOrCreateCompany,
  findOrCreateLocation,
  getDefaultLocation,
  listCategories,
  resolveUnitType,
} from "@/lib/services/reference";
import { adjustInventory, getOnHand } from "@/lib/services/inventory";
import { productSummary } from "@/lib/harness/tools/_helpers";

/**
 * Distru MCP server (Streamable HTTP, JSON-RPC 2.0). Lets an EXTERNAL agent
 * drive our platform - the mirror image of our own copilot. Auth via Bearer API
 * token, same as the public REST API. Tools run directly against the services.
 */

type McpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, ctx: ServiceCtx) => Promise<unknown>;
};

const s = (desc?: string) => ({ type: "string", ...(desc ? { description: desc } : {}) });
const n = (desc?: string) => ({ type: "number", ...(desc ? { description: desc } : {}) });

const TOOLS: McpTool[] = [
  {
    name: "distru-search-products",
    description: "Search the product catalog by name or SKU.",
    inputSchema: {
      type: "object",
      properties: { query: s("name or SKU fragment"), limit: n() },
      required: [],
    },
    async handler(args, ctx) {
      const { items, total } = await listProducts(ctx, {
        search: args.query as string | undefined,
        limit: (args.limit as number) ?? 25,
      });
      return { total, products: items.map(productSummary) };
    },
  },
  {
    name: "distru-get-product",
    description: "Get one product by SKU, including on-hand inventory.",
    inputSchema: { type: "object", properties: { sku: s() }, required: ["sku"] },
    async handler(args, ctx) {
      const p = await getProductBySku(ctx, String(args.sku));
      if (!p) return { error: "not found" };
      return { ...productSummary(p), on_hand: await getOnHand(ctx, p.product.id) };
    },
  },
  {
    name: "distru-create-product",
    description: "Create a product. Category/vendor are created if new.",
    inputSchema: {
      type: "object",
      properties: {
        name: s(),
        sku: s(),
        unit_type: s("e.g. Gram, Ounce, Unit"),
        category: s(),
        vendor: s(),
        unit_price: n(),
      },
      required: ["name", "sku", "unit_type"],
    },
    async handler(args, ctx) {
      const unit = await resolveUnitType(String(args.unit_type));
      if (!unit) return { error: `unknown unit type ${args.unit_type}` };
      const category = args.category
        ? await findOrCreateCategory(ctx, String(args.category))
        : null;
      const vendor = args.vendor
        ? await findOrCreateCompany(ctx, String(args.vendor))
        : null;
      const p = await createProduct(ctx, {
        name: String(args.name),
        sku: String(args.sku),
        unitTypeId: unit.id,
        categoryId: category?.id ?? null,
        vendorId: vendor?.id ?? null,
        unitPrice: (args.unit_price as number) ?? null,
      });
      return { id: p.product.id, sku: p.product.sku };
    },
  },
  {
    name: "distru-adjust-inventory",
    description: "Adjust on-hand inventory for a product by a delta.",
    inputSchema: {
      type: "object",
      properties: { sku: s(), delta: n(), location: s() },
      required: ["sku", "delta"],
    },
    async handler(args, ctx) {
      const p = await getProductBySku(ctx, String(args.sku));
      if (!p) return { error: "product not found" };
      const location = args.location
        ? await findOrCreateLocation(ctx, String(args.location))
        : await getDefaultLocation(ctx);
      const { onHand } = await adjustInventory(ctx, {
        productId: p.product.id,
        locationId: location.id,
        delta: Number(args.delta),
      });
      return { on_hand: onHand, location: location.name };
    },
  },
  {
    name: "distru-list-categories",
    description: "List product categories.",
    inputSchema: { type: "object", properties: {}, required: [] },
    async handler(_args, ctx) {
      return { categories: (await listCategories(ctx)).map((c) => c.name) };
    },
  },
];

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
    return rpcResult(id, {
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
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
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
    try {
      const result = await tool.handler(args, ctx);
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
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
    tools: TOOLS.map((t) => t.name),
  });
}
