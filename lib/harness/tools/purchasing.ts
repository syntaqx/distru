import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import { findOrCreateVendor } from "@/lib/modules/catalog";
import {
  createPurchaseOrder,
  getPurchaseOrderByNumber,
  listPurchaseOrders,
  purchaseOrderTotal,
  receivePurchaseOrder,
  type PurchaseOrderItemInput,
} from "@/lib/modules/purchasing";
import { resolveProduct } from "./_helpers";

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

const poLineSchema = z.object({
  product: z.string().describe("SKU or product name"),
  quantity: z.number().positive(),
  unit_cost: z.number().min(0).optional().describe("Cost per unit; defaults to 0"),
});

type PoLineInput = z.infer<typeof poLineSchema>;

/** Resolve line items (by SKU/name) for both preview and execution. */
async function resolveLines(ctx: AgentContext, items: PoLineInput[]) {
  const lines: (PurchaseOrderItemInput & { quantity: number; unitCost: number })[] = [];
  const missing: string[] = [];
  for (const line of items) {
    const p = await resolveProduct(ctx.service, { sku: line.product, name: line.product });
    if (!p) {
      missing.push(line.product);
      // Keep an unresolved line so the PO still records what was requested.
      lines.push({
        productId: null,
        sku: null,
        name: line.product,
        quantity: line.quantity,
        unitCost: line.unit_cost ?? 0,
      });
      continue;
    }
    lines.push({
      productId: p.product.id,
      sku: p.product.sku,
      name: p.product.name,
      quantity: line.quantity,
      unitCost: line.unit_cost ?? 0,
    });
  }
  const total = purchaseOrderTotal(lines);
  return { lines, missing, total };
}

export const createPurchaseOrderTool = defineTool({
  name: "create_purchase_order",
  description:
    "Create a purchase order for a vendor (created with the VENDOR role if new) " +
    "with one or more line items (each product matched by SKU or name), quantity, " +
    "and unit cost. Defaults to OPEN status; use status 'draft' to hold as DRAFT or " +
    "'received' to receive it immediately (which increments stock).",
  gate: "confirmation",
  inputSchema: z.object({
    vendor: z.string().describe("Vendor name"),
    items: z.array(poLineSchema).min(1),
    status: z.enum(["draft", "open", "received"]).optional(),
    notes: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const { lines, missing, total } = await resolveLines(ctx, input.items);
    const fields = lines.map((l) => ({
      label: l.sku ? `${l.name} (${l.sku})` : l.name,
      value: `${l.quantity} × ${money(l.unitCost)} = ${money(l.quantity * l.unitCost)}`,
    }));
    fields.unshift({ label: "Vendor", value: input.vendor });
    if (missing.length) fields.push({ label: "Unmatched (no stock)", value: missing.join(", ") });
    fields.push({ label: "PO total", value: money(total) });
    return confirm(
      "Create purchase order",
      `Purchase ${lines.length} item(s) from ${input.vendor} for ${money(total)}.`,
      fields,
    );
  },
  async execute(input, ctx) {
    const vendor = await findOrCreateVendor(ctx.service, input.vendor);
    const { lines, missing } = await resolveLines(ctx, input.items);
    const status =
      input.status === "draft" ? "DRAFT" : input.status === "received" ? "RECEIVED" : "OPEN";
    try {
      const po = await createPurchaseOrder(ctx.service, {
        vendorId: vendor.id,
        items: lines,
        status,
        notes: input.notes,
      });
      const warn = missing.length ? ` (unmatched: ${missing.join(", ")})` : "";
      return {
        ok: true,
        summary: `Created PO ${po.purchaseOrder.poNumber} for ${vendor.name} - ${money(po.total)} (${po.purchaseOrder.status})${warn}.`,
        data: {
          po_number: po.purchaseOrder.poNumber,
          status: po.purchaseOrder.status,
          total: po.total,
          vendor: vendor.name,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "PO create failed." };
    }
  },
});

export const receivePurchaseOrderTool = defineTool({
  name: "receive_purchase_order",
  description:
    "Receive a purchase order (by PO number), moving it to RECEIVED and incrementing " +
    "on-hand stock for each line's product at the PO's location.",
  gate: "confirmation",
  inputSchema: z.object({ po_number: z.string() }),
  async buildPreview(input, ctx) {
    const po = await getPurchaseOrderByNumber(ctx.service, input.po_number);
    return confirm(
      "Receive purchase order",
      po
        ? `Receive PO ${po.purchaseOrder.poNumber} (${money(po.total)}) and add its items to stock.`
        : `Receive PO ${input.po_number}.`,
      [
        { label: "PO", value: input.po_number },
        { label: "Vendor", value: po?.vendor?.name ?? "-" },
        { label: "Lines", value: po ? String(po.items.length) : "-" },
        { label: "Total", value: po ? money(po.total) : "-" },
      ],
    );
  },
  async execute(input, ctx) {
    const po = await getPurchaseOrderByNumber(ctx.service, input.po_number);
    if (!po) return { ok: false, summary: `No purchase order ${input.po_number}.` };
    try {
      const received = await receivePurchaseOrder(ctx.service, po.purchaseOrder.id);
      return {
        ok: true,
        summary: `Received PO ${received.purchaseOrder.poNumber}; stock incremented.`,
        data: { po_number: received.purchaseOrder.poNumber, status: received.purchaseOrder.status },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Receive failed." };
    }
  },
});

export const listPurchaseOrdersTool = defineTool({
  name: "list_purchase_orders",
  description: "List purchase orders, optionally filtered by status (DRAFT, OPEN, RECEIVED, CANCELED).",
  gate: "none",
  inputSchema: z.object({
    status: z.enum(["DRAFT", "OPEN", "RECEIVED", "CANCELED"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listPurchaseOrders(ctx.service, {
      status: input.status,
      limit: input.limit ?? 25,
    });
    return {
      ok: true,
      summary: `${total} purchase order(s); showing ${items.length}.`,
      data: {
        total,
        purchase_orders: items.map((p) => ({
          po_number: p.purchaseOrder.poNumber,
          status: p.purchaseOrder.status,
          vendor: p.vendor?.name ?? null,
          items: p.itemCount,
          total: p.total,
        })),
      },
    };
  },
});

export const purchasingTools = [
  createPurchaseOrderTool,
  receivePurchaseOrderTool,
  listPurchaseOrdersTool,
];
