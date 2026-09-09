import { and, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, invoices, orderItems, orders } from "@/db/schema";
import type { ServiceCtx } from "../shared";

/**
 * Sales analytics - the read-only reporting surface over orders, invoices, and
 * payments. Mirrors the reports Distru operators actually live in: product/brand
 * performance ("best sellers"), a revenue + AR financial summary, top customers,
 * and an open-invoice / collections aging list. Pure aggregate queries: no row
 * dumps, so they're cheap to run from the UI, the Copilot, and the MCP alike.
 */

/** An order counts as a booked sale once it leaves PENDING and isn't canceled. */
const SOLD_STATUSES = [
  "PROCESSING",
  "READY_TO_SHIP",
  "DELIVERING",
  "DELIVERED",
  "COMPLETED",
] as const;

/** A relative reporting window. `all` means since the beginning of time. */
export type Period = "7d" | "30d" | "90d" | "12m" | "ytd" | "all";

/** Turn a period token into a cutoff Date (or null for "all"). */
export function periodStart(period: Period = "all", now = new Date()): Date | null {
  const d = new Date(now);
  switch (period) {
    case "7d": d.setDate(d.getDate() - 7); return d;
    case "30d": d.setDate(d.getDate() - 30); return d;
    case "90d": d.setDate(d.getDate() - 90); return d;
    case "12m": d.setMonth(d.getMonth() - 12); return d;
    case "ytd": return new Date(now.getFullYear(), 0, 1);
    case "all": return null;
  }
}

/** WHERE clauses selecting this org's booked (sold) orders within the window. */
function soldWhere(ctx: ServiceCtx, since: Date | null): SQL {
  const filters: SQL[] = [
    eq(orders.organizationId, ctx.orgId),
    inArray(orders.status, [...SOLD_STATUSES]),
  ];
  if (since) filters.push(gte(orders.orderDate, since));
  return and(...filters)!;
}

export type TopProduct = {
  sku: string;
  name: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
};

/**
 * Best-selling products in the window, ranked by revenue (default) or units.
 * Aggregates order lines across booked orders and groups by SKU.
 */
export async function topProducts(
  ctx: ServiceCtx,
  opts: { period?: Period; limit?: number; by?: "revenue" | "quantity" } = {},
): Promise<TopProduct[]> {
  const since = periodStart(opts.period ?? "all");
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 100);
  const revenueExpr = sql<string>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`;
  const quantityExpr = sql<string>`sum(${orderItems.quantity})`;
  const rows = await db
    .select({
      sku: orderItems.sku,
      name: sql<string>`max(${orderItems.name})`,
      quantitySold: quantityExpr,
      revenue: revenueExpr,
      orderCount: sql<string>`count(distinct ${orderItems.orderId})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(soldWhere(ctx, since))
    .groupBy(orderItems.sku)
    .orderBy(desc(opts.by === "quantity" ? quantityExpr : revenueExpr))
    .limit(limit);
  return rows
    .filter((r) => r.sku)
    .map((r) => ({
      sku: r.sku ?? "",
      name: r.name ?? "",
      quantitySold: Number(r.quantitySold),
      revenue: Number(r.revenue),
      orderCount: Number(r.orderCount),
    }));
}

export type TopCustomer = {
  customerId: string;
  name: string;
  orderCount: number;
  revenue: number;
};

/** Highest-revenue customers in the window. */
export async function topCustomers(
  ctx: ServiceCtx,
  opts: { period?: Period; limit?: number } = {},
): Promise<TopCustomer[]> {
  const since = periodStart(opts.period ?? "all");
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 100);
  const revenueExpr = sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`;
  const rows = await db
    .select({
      customerId: orders.customerId,
      name: sql<string>`max(${companies.name})`,
      orderCount: sql<string>`count(distinct ${orders.id})`,
      revenue: revenueExpr,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(companies, eq(orders.customerId, companies.id))
    .where(soldWhere(ctx, since))
    .groupBy(orders.customerId)
    .orderBy(desc(revenueExpr))
    .limit(limit);
  return rows
    .filter((r) => r.customerId)
    .map((r) => ({
      customerId: r.customerId ?? "",
      name: r.name ?? "(no customer)",
      orderCount: Number(r.orderCount),
      revenue: Number(r.revenue),
    }));
}

export type SalesSummary = {
  period: Period;
  orderCount: number;
  unitsSold: number;
  revenue: number;
  averageOrderValue: number;
  invoicedTotal: number;
  collected: number;
  outstanding: number;
};

/**
 * A single financial snapshot for the window: booked revenue and units from
 * orders, plus invoiced / collected / outstanding (AR) from invoices. The one
 * number an operator asks for first - "how are we doing?"
 */
export async function salesSummary(
  ctx: ServiceCtx,
  opts: { period?: Period } = {},
): Promise<SalesSummary> {
  const period = opts.period ?? "all";
  const since = periodStart(period);

  const [orderAgg] = await db
    .select({
      orderCount: sql<string>`count(distinct ${orders.id})`,
      unitsSold: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`,
      revenue: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(soldWhere(ctx, since));

  const invFilters: SQL[] = [
    eq(invoices.organizationId, ctx.orgId),
    eq(invoices.voided, false),
  ];
  if (since) invFilters.push(gte(invoices.issueDate, since));
  const [invAgg] = await db
    .select({
      invoicedTotal: sql<string>`coalesce(sum(${invoices.total}), 0)`,
      collected: sql<string>`coalesce(sum(${invoices.amountPaid}), 0)`,
    })
    .from(invoices)
    .where(and(...invFilters));

  const orderCount = Number(orderAgg?.orderCount ?? 0);
  const revenue = Number(orderAgg?.revenue ?? 0);
  const invoicedTotal = Number(invAgg?.invoicedTotal ?? 0);
  const collected = Number(invAgg?.collected ?? 0);
  return {
    period,
    orderCount,
    unitsSold: Number(orderAgg?.unitsSold ?? 0),
    revenue,
    averageOrderValue: orderCount ? revenue / orderCount : 0,
    invoicedTotal,
    collected,
    outstanding: invoicedTotal - collected,
  };
}

export type OpenInvoice = {
  invoiceNumber: string;
  customer: string | null;
  status: string;
  total: number;
  amountPaid: number;
  balance: number;
  issuedAt: string | null;
  dueAt: string | null;
  daysOutstanding: number;
};

/**
 * The open-invoice / collections report: unpaid and partially-paid invoices
 * with their outstanding balance and age, oldest first - Distru's AR view.
 */
export async function openInvoices(
  ctx: ServiceCtx,
  opts: { limit?: number } = {},
): Promise<{ invoices: OpenInvoice[]; totalOutstanding: number; count: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const rows = await db
    .select({ invoice: invoices, customer: { name: companies.name } })
    .from(invoices)
    .leftJoin(companies, eq(invoices.customerId, companies.id))
    .where(
      and(
        eq(invoices.organizationId, ctx.orgId),
        eq(invoices.voided, false),
        inArray(invoices.status, ["NOT_PAID", "PARTIALLY_PAID"]),
      ),
    )
    .orderBy(desc(invoices.issueDate))
    .limit(limit);

  const now = Date.now();
  const list: OpenInvoice[] = rows.map((r) => {
    const total = Number(r.invoice.total);
    const amountPaid = Number(r.invoice.amountPaid);
    const issued = r.invoice.issueDate ? new Date(r.invoice.issueDate) : null;
    return {
      invoiceNumber: r.invoice.invoiceNumber,
      customer: r.customer?.name ?? null,
      status: r.invoice.status,
      total,
      amountPaid,
      balance: total - amountPaid,
      issuedAt: issued ? issued.toISOString() : null,
      dueAt: r.invoice.dueDate ? new Date(r.invoice.dueDate).toISOString() : null,
      daysOutstanding: issued
        ? Math.floor((now - issued.getTime()) / 86_400_000)
        : 0,
    };
  });
  const totalOutstanding = list.reduce((a, i) => a + i.balance, 0);
  return { invoices: list, totalOutstanding, count: list.length };
}
