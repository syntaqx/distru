import { z } from "zod";
import { defineTool } from "../tool";
import {
  openInvoices,
  salesSummary,
  topCustomers,
  topProducts,
  type Period,
} from "@/lib/modules/sales";

/**
 * Analytics / reporting tools - the read-only "how's the business doing?" surface.
 * All gate: "none", so they auto-run for the Copilot and, via the MCP bridge, are
 * exposed to external agents too. This is what lets the assistant answer
 * best-seller and financial questions instead of just mutating records.
 */

const periodSchema = z
  .enum(["7d", "30d", "90d", "12m", "ytd", "all"])
  .optional()
  .describe("Reporting window; defaults to all time.");

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export const salesSummaryTool = defineTool({
  name: "sales_summary",
  description:
    "Financial snapshot for a period: booked revenue, units sold, order count, " +
    "average order value, and invoiced / collected / outstanding (AR). Use this " +
    "for questions like 'how are sales?', 'what's our revenue this month?', or " +
    "'how much are we owed?'.",
  gate: "none",
  inputSchema: z.object({ period: periodSchema }),
  async execute(input, ctx) {
    const s = await salesSummary(ctx.service, { period: input.period as Period });
    return {
      ok: true,
      summary:
        `${input.period ?? "all"}: ${money(s.revenue)} revenue across ${s.orderCount} order(s), ` +
        `${money(s.outstanding)} outstanding.`,
      data: s,
    };
  },
});

export const topProductsTool = defineTool({
  name: "top_products",
  description:
    "Best-selling products for a period, ranked by revenue (default) or by units " +
    "sold. Use for 'what are our top sellers?', 'best products this quarter', etc.",
  gate: "none",
  inputSchema: z.object({
    period: periodSchema,
    limit: z.number().int().min(1).max(100).optional(),
    by: z.enum(["revenue", "quantity"]).optional().describe("ranking metric; defaults to revenue"),
  }),
  async execute(input, ctx) {
    const rows = await topProducts(ctx.service, {
      period: input.period as Period,
      limit: input.limit,
      by: input.by,
    });
    const lead = rows[0];
    return {
      ok: true,
      summary: lead
        ? `Top seller: ${lead.name} (${lead.sku}) - ${lead.quantitySold} units, ${money(lead.revenue)}.`
        : "No sales in this period.",
      data: {
        by: input.by ?? "revenue",
        products: rows.map((r) => ({
          sku: r.sku,
          name: r.name,
          units_sold: r.quantitySold,
          revenue: r.revenue,
          orders: r.orderCount,
        })),
      },
    };
  },
});

export const topCustomersTool = defineTool({
  name: "top_customers",
  description:
    "Highest-revenue customers for a period. Use for 'who are our biggest " +
    "customers?' or 'top accounts this year'.",
  gate: "none",
  inputSchema: z.object({
    period: periodSchema,
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async execute(input, ctx) {
    const rows = await topCustomers(ctx.service, {
      period: input.period as Period,
      limit: input.limit,
    });
    return {
      ok: true,
      summary: rows.length
        ? `${rows.length} customer(s); top is ${rows[0].name} at ${money(rows[0].revenue)}.`
        : "No sales in this period.",
      data: {
        customers: rows.map((r) => ({
          name: r.name,
          orders: r.orderCount,
          revenue: r.revenue,
        })),
      },
    };
  },
});

export const openInvoicesTool = defineTool({
  name: "open_invoices",
  description:
    "Open-invoice / collections report: unpaid and partially-paid invoices with " +
    "their outstanding balance and age (days outstanding), plus the total AR. Use " +
    "for 'what's outstanding?', 'who owes us money?', or 'accounts receivable'.",
  gate: "none",
  inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional() }),
  async execute(input, ctx) {
    const { invoices: rows, totalOutstanding, count } = await openInvoices(ctx.service, {
      limit: input.limit,
    });
    return {
      ok: true,
      summary: `${count} open invoice(s), ${money(totalOutstanding)} outstanding.`,
      data: {
        total_outstanding: totalOutstanding,
        count,
        invoices: rows.map((r) => ({
          invoice_number: r.invoiceNumber,
          customer: r.customer,
          status: r.status,
          total: r.total,
          amount_paid: r.amountPaid,
          balance: r.balance,
          days_outstanding: r.daysOutstanding,
          due_at: r.dueAt,
        })),
      },
    };
  },
});

export const analyticsTools = [
  salesSummaryTool,
  topProductsTool,
  topCustomersTool,
  openInvoicesTool,
];
