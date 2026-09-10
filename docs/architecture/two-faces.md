---
title: "One capability, two faces"
section: "Copilot & take-home"
summary: "How a tool defined once powers both the built-in Copilot and the MCP server."
keywords: ["mcp","mcp bridge","two faces","one capability","tool registry","derived","reuse","harness tool","external agent","claude desktop","cursor","drift","single source of truth"]
order: 113
---
# One capability, two faces

Distru's tools have to be usable two ways: through the **built-in Copilot** (a human chatting in-app) and through the **MCP server** (an external agent - Claude Desktop, Cursor, Claude Code - driving Distru over `POST /api/mcp`). The rule that keeps them honest: a capability is **defined once** and **surfaced twice**. Add a tool and it appears on both faces automatically; there is no second list to keep in sync.

## The problem this solves

Originally the MCP server hand-wrote its own tool definitions - a parallel `TOOLS` array with its own JSON Schemas and its own handlers calling the domain modules. That is duplication with a deadline: the day someone adds `record_payment` to the Copilot, the MCP silently lacks it; the day a tool's input changes, the two schemas drift. The external surface was a strictly smaller, staler copy of the internal one.

Now both faces read from the **same harness tool registry**.

## The bridge

`lib/harness/mcp-bridge.ts` is the whole adapter. It takes the harness tool arrays the Copilot already runs and re-presents them as MCP tools. The exposed set is the **full operational surface across every module** - sixteen tool groups, not a curated handful:

```ts
// The domain capabilities offered to external agents - every module.
const EXPOSED = [
  ...catalogTools, ...mutationTools, ...inventoryTools, ...salesTools,
  ...analyticsTools, ...reportTools, ...cultivationTools, ...purchasingTools,
  ...manufacturingTools, ...schedulingTools, ...complianceTools, ...growTools,
  ...logisticsTools, ...crmTools, ...taskTools, ...integrationTools,
];

// Harness name (create_order) -> MCP name (distru-create-order).
const mcpName = (n: string) => `distru-${n.replace(/_/g, "-")}`;

export function listMcpTools() {
  return EXPOSED.map((tool) => ({
    name: mcpName(tool.name),
    description: tool.description,
    // JSON Schema derived from the SAME Zod schema the Copilot validates with
    inputSchema: jsonSchema(tool),
  }));
}

export async function callMcpTool(name, args, service: ServiceCtx) {
  const tool = byMcpName.get(name);
  if (!tool) return { ok: false, summary: `Unknown tool: ${name}` };
  const parsed = tool.inputSchema.safeParse(args ?? {}); // same validation
  if (!parsed.success) return { ok: false, summary: /* field errors */ };
  const ctx = { service, userId: null, conversationId: "mcp", emit: () => {} };
  return tool.execute(parsed.data, ctx);                 // same execute()
}
```

Three things travel across the bridge unchanged, and that is the point:

- **The schema** - `inputSchema` is turned into JSON Schema with `z.toJSONSchema(...)`, so the MCP tool advertises exactly the shape the tool actually validates. A tool cannot describe itself one way to Claude Desktop and accept another internally.
- **The description** - the same one the model reads in chat, so both agents get the same guidance.
- **The execution** - `callMcpTool` runs the tool's own `execute`, the identical code path the Copilot runs after a human clicks Approve.

## The MCP route is now thin

`app/api/mcp/route.ts` no longer knows anything about products or orders. It is pure JSON-RPC plumbing over the bridge:

```ts
if (method === "tools/list") return rpcResult(id, { tools: listMcpTools() });

if (method === "tools/call") {
  const ctx = { orgId: token.orgId, actor: `mcp:${token.tokenId}`, actorType: "api" };
  const result = await callMcpTool(name, args, ctx);
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(result.data ?? result.summary) }],
    isError: !result.ok,
  });
}
```

## What about the human-in-the-loop gate?

The Copilot pauses gated (`confirmation` / `question`) tools for a human to approve. The MCP has no such human at *our* end - **the external agent is its own human-in-the-loop**. So the bridge runs the tool's `execute` directly, which is the same code that runs in-app *after* approval. Nothing is bypassed: the mutation still goes through the one domain function, and the `audit_log` still records it - attributed to `mcp:<tokenId>` rather than a person. Governance lives in the domain, not in the chrome around it.

## The external surface: full domain, not a sampler

Because the MCP derives from the registry, the external agent gets the **full** capability set - **65 tools** (of the ~80 the Copilot runs), spanning every module:

- **Catalog** - `search_products`, `get_product`, `create_product`, `update_product`, `archive_product`, `create_category`, `create_vendor`, and the bulk `bulk_update_products` / `bulk_set_on_hand`.
- **Inventory** - `inventory_report`, `adjust_inventory`, `set_on_hand`, plus transactional `transfer_stock` and `scan_code`.
- **Sales** - `create_order`, `create_invoice`, `record_payment`, `cancel_order`, `list_orders`, `get_order`, `list_invoices`.
- **Purchasing** - `create_purchase_order`, `receive_purchase_order`, `list_purchase_orders`.
- **Manufacturing** - `create_assembly`, `complete_assembly`, `list_assemblies`, plus `schedule_assembly` / `list_scheduled_assemblies`.
- **Cultivation & grow** - `create_plant_batch`, `move_plant_phase`, `advance_plant_batch`, `create_harvest`, `package_harvest`, `record_coa`, and the list reads.
- **Compliance** - `create_license`, `record_test_result`, `list_licenses`, `list_test_results`, `list_expiring_licenses`.
- **Logistics** - `create_delivery`, `assign_delivery`, `list_deliveries`.
- **Analytics & reports** - `sales_summary`, `top_products`, `top_customers`, `open_invoices`, plus `generate_report`, `save_report`, `email_report`, `upload_to_drive`.
- **CRM & tasks** - `add_company_note`, `list_company_notes`, `create_task`, `list_tasks`, `complete_task`.
- **Integrations** - `list_integrations`, `connect_integration`, `disconnect_integration`, `sync_integration`.

Every one appears the moment it exists for the Copilot. Internal-only tools (docs search, the import-job pipeline, automation/workflow management, and `ask_user`) are deliberately left off `EXPOSED` because they need chat/session state an external caller doesn't have.

## Mirroring - and exceeding - Distru's own MCP

Distru ships an official MCP server too, but it is narrow: roughly **45 tools that are mostly per-report readouts plus generic `search` / `get` primitives**. Ours covers the same ground and then keeps going: full reads *and* full CRUD across every module - create an order, receive a PO, transfer stock between locations, complete a manufacturing assembly, record a COA, dispatch a delivery, generate and email a report - not just query it. Reaching parity was never the goal; the point is that "one tool definition, both faces" means the external surface grows for free every time the product does, so it is broader than a hand-maintained parallel list can stay.

```jsonc
// tools/call - an external agent moving real inventory, then reporting on it
{ "method": "tools/call",
  "params": { "name": "distru-transfer-stock",
              "arguments": { "sku": "GG4-3.5", "from_location": "Vault",
                             "to_location": "Dispensary Floor", "quantity": 24 } } }

{ "method": "tools/call",
  "params": { "name": "distru-generate-report",
              "arguments": { "report": "low-stock" } } }
```

This is the same "one domain, many faces" idea from the [architecture overview](/docs/architecture), applied one level up: there, one module function backs the UI, REST, and MCP; here, one *tool definition* backs both agentic faces. See [The agentic harness](/docs/harness) for the tool contract itself, and [API, MCP, and webhooks](/docs/api-and-integrations) for connecting a client.
