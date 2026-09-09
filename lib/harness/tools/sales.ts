import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import { findOrCreateCustomer } from "@/lib/modules/catalog";
import {
  cancelOrder,
  createOrder,
  getOrderByNumber,
  listOrders,
  orderTotal,
  type OrderItemInput,
} from "@/lib/modules/sales";
import {
  createInvoiceForOrder,
  getInvoiceByNumber,
  listInvoices,
  recordPayment,
} from "@/lib/modules/sales";
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

const orderLineSchema = z.object({
  product: z.string().describe("SKU or product name"),
  quantity: z.number().positive(),
  unit_price: z.number().optional().describe("defaults to the product's unit price"),
});

type OrderLineInput = z.infer<typeof orderLineSchema>;

/** Resolve customer + line items for both the preview and the execution paths. */
async function resolveOrder(
  ctx: AgentContext,
  input: { customer: string; items: OrderLineInput[] },
) {
  const lines: (OrderItemInput & { unitPrice: number })[] = [];
  const missing: string[] = [];
  for (const line of input.items) {
    const p = await resolveProduct(ctx.service, { sku: line.product, name: line.product });
    if (!p) {
      missing.push(line.product);
      continue;
    }
    const unitPrice = line.unit_price ?? Number(p.product.unitPrice ?? 0);
    lines.push({
      productId: p.product.id,
      sku: p.product.sku,
      name: p.product.name,
      quantity: line.quantity,
      unitPrice,
    });
  }
  return { lines, missing, total: orderTotal(lines) };
}

export const createOrderTool = defineTool({
  name: "create_order",
  description:
    "Create a sales order for a customer with one or more line items and " +
    "decrement inventory. The customer is created (with the CUSTOMER role) if " +
    "new; each line's product is matched by SKU or name. Defaults to a confirmed " +
    "order (PROCESSING, which decrements stock); pass status 'draft' to hold it as PENDING.",
  gate: "confirmation",
  inputSchema: z.object({
    customer: z.string(),
    items: z.array(orderLineSchema).min(1),
    status: z.enum(["draft", "confirmed"]).optional(),
    notes: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const { lines, missing, total } = await resolveOrder(ctx, input);
    const fields = lines.map((l) => ({
      label: `${l.name} (${l.sku})`,
      value: `${l.quantity} × ${money(Number(l.unitPrice))} = ${money(Number(l.quantity) * Number(l.unitPrice))}`,
    }));
    fields.unshift({ label: "Customer", value: input.customer });
    if (missing.length) fields.push({ label: "Not found", value: missing.join(", ") });
    fields.push({ label: "Order total", value: money(total) });
    return confirm(
      "Create sales order",
      `Sell ${lines.length} item(s) to ${input.customer} for ${money(total)}.`,
      fields,
    );
  },
  async execute(input, ctx) {
    const customer = await findOrCreateCustomer(ctx.service, input.customer);
    const { lines, missing } = await resolveOrder(ctx, input);
    if (lines.length === 0)
      return { ok: false, summary: `No products matched: ${missing.join(", ")}.` };
    const order = await createOrder(ctx.service, {
      customerId: customer.id,
      items: lines,
      status: input.status === "draft" ? "PENDING" : "PROCESSING",
      notes: input.notes,
    });
    const warn = missing.length ? ` (skipped: ${missing.join(", ")})` : "";
    return {
      ok: true,
      summary: `Created order ${order.order.orderNumber} for ${customer.name} - ${money(order.total)}${warn}.`,
      data: { order_number: order.order.orderNumber, total: order.total, status: order.order.status },
    };
  },
});

export const createInvoiceTool = defineTool({
  name: "create_invoice",
  description: "Generate an invoice for an existing sales order (by order number).",
  gate: "confirmation",
  inputSchema: z.object({
    order_number: z.string(),
    due_date: z.string().optional().describe("ISO date, e.g. 2026-10-01"),
  }),
  async buildPreview(input, ctx) {
    const order = await getOrderByNumber(ctx.service, input.order_number);
    return confirm(
      "Create invoice",
      order
        ? `Invoice order ${order.order.orderNumber} for ${money(order.total)}.`
        : `Invoice order ${input.order_number}.`,
      [
        { label: "Order", value: input.order_number },
        { label: "Amount", value: order ? money(order.total) : "-" },
        { label: "Due date", value: input.due_date ?? "on receipt" },
      ],
    );
  },
  async execute(input, ctx) {
    const order = await getOrderByNumber(ctx.service, input.order_number);
    if (!order) return { ok: false, summary: `No order ${input.order_number}.` };
    const dueDate = input.due_date ? new Date(input.due_date) : undefined;
    try {
      const inv = await createInvoiceForOrder(ctx.service, order.order.id, { dueDate });
      return {
        ok: true,
        summary: `Created invoice ${inv.invoice.invoiceNumber} for ${money(Number(inv.invoice.total))}.`,
        data: { invoice_number: inv.invoice.invoiceNumber, total: inv.invoice.total },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Invoice failed." };
    }
  },
});

export const recordPaymentTool = defineTool({
  name: "record_payment",
  description: "Record a payment against an invoice (by invoice number).",
  gate: "confirmation",
  inputSchema: z.object({
    invoice_number: z.string(),
    amount: z.number().positive(),
    method: z.string().optional().describe("cash, check, ach, card…"),
  }),
  async buildPreview(input) {
    return confirm(
      "Record payment",
      `Apply ${money(input.amount)} to ${input.invoice_number}.`,
      [
        { label: "Invoice", value: input.invoice_number },
        { label: "Amount", value: money(input.amount) },
        { label: "Method", value: input.method ?? "cash" },
      ],
      "low",
    );
  },
  async execute(input, ctx) {
    const inv = await getInvoiceByNumber(ctx.service, input.invoice_number);
    if (!inv) return { ok: false, summary: `No invoice ${input.invoice_number}.` };
    try {
      const updated = await recordPayment(ctx.service, inv.invoice.id, {
        amount: input.amount,
        method: input.method,
      });
      return {
        ok: true,
        summary: `Recorded ${money(input.amount)} on ${updated.invoice.invoiceNumber} - now ${updated.invoice.status}.`,
        data: { invoice_number: updated.invoice.invoiceNumber, status: updated.invoice.status },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Payment failed." };
    }
  },
});

export const cancelOrderTool = defineTool({
  name: "cancel_order",
  description: "Cancel a sales order (by order number) and restore any stock it took.",
  gate: "confirmation",
  inputSchema: z.object({ order_number: z.string() }),
  async buildPreview(input, ctx) {
    const order = await getOrderByNumber(ctx.service, input.order_number);
    return confirm(
      "Cancel order",
      order
        ? `Cancel order ${order.order.orderNumber} and restore stock.`
        : `Cancel order ${input.order_number}.`,
      [{ label: "Order", value: input.order_number }],
      "high",
    );
  },
  async execute(input, ctx) {
    const order = await getOrderByNumber(ctx.service, input.order_number);
    if (!order) return { ok: false, summary: `No order ${input.order_number}.` };
    try {
      const cancelled = await cancelOrder(ctx.service, order.order.id);
      return {
        ok: true,
        summary: `Cancelled order ${cancelled.order.orderNumber}; stock restored.`,
        data: { order_number: cancelled.order.orderNumber, status: cancelled.order.status },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Cancel failed." };
    }
  },
});

export const listOrdersTool = defineTool({
  name: "list_orders",
  description: "List sales orders, optionally filtered by status. Returns compact summaries.",
  gate: "none",
  inputSchema: z.object({
    status: z
      .enum(["PENDING", "PROCESSING", "READY_TO_SHIP", "DELIVERING", "DELIVERED", "COMPLETED", "CANCELED"])
      .optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listOrders(ctx.service, {
      status: input.status,
      limit: input.limit ?? 25,
    });
    return {
      ok: true,
      summary: `${total} order(s); showing ${items.length}.`,
      data: {
        total,
        orders: items.map((o) => ({
          order_number: o.order.orderNumber,
          status: o.order.status,
          customer: o.customer?.name ?? null,
          items: o.itemCount,
          total: o.total,
        })),
      },
    };
  },
});

export const getOrderTool = defineTool({
  name: "get_order",
  description: "Get one sales order by order number, including its line items.",
  gate: "none",
  inputSchema: z.object({ order_number: z.string() }),
  async execute(input, ctx) {
    const order = await getOrderByNumber(ctx.service, input.order_number);
    if (!order) return { ok: false, summary: `No order ${input.order_number}.` };
    return {
      ok: true,
      summary: `Order ${order.order.orderNumber} (${order.order.status}) - ${money(order.total)}.`,
      data: {
        order_number: order.order.orderNumber,
        status: order.order.status,
        customer: order.customer?.name ?? null,
        total: order.total,
        items: order.items.map((i) => ({
          sku: i.sku,
          name: i.name,
          quantity: Number(i.quantity),
          unit_price: Number(i.unitPrice),
        })),
      },
    };
  },
});

export const listInvoicesTool = defineTool({
  name: "list_invoices",
  description: "List invoices, optionally filtered by payment status (NOT_PAID, PARTIALLY_PAID, FULLY_PAID, OVER_PAID).",
  gate: "none",
  inputSchema: z.object({
    status: z.enum(["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID", "OVER_PAID"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listInvoices(ctx.service, {
      status: input.status,
      limit: input.limit ?? 25,
    });
    return {
      ok: true,
      summary: `${total} invoice(s); showing ${items.length}.`,
      data: {
        total,
        invoices: items.map((i) => ({
          invoice_number: i.invoice.invoiceNumber,
          status: i.invoice.status,
          customer: i.customer?.name ?? null,
          total: Number(i.invoice.total),
          amount_paid: Number(i.invoice.amountPaid),
        })),
      },
    };
  },
});

export const salesTools = [
  createOrderTool,
  createInvoiceTool,
  recordPaymentTool,
  cancelOrderTool,
  listOrdersTool,
  getOrderTool,
  listInvoicesTool,
];
