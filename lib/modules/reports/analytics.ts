import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, companies, invoices, orderItems, orders, payments, products } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { onHandByProduct } from "@/lib/modules/inventory";

/**
 * Reporting analytics - read-only cross-domain aggregations that back the
 * higher-value Insights reports (AR aging, the sales matrix, per-product margin,
 * payments, low-stock reorder). These compose the same tables the domain modules
 * own but stay in the reporting context so no domain module has to grow a
 * reporting-only query. Pure aggregate reads: no writes, no row dumps.
 */

/** An order counts as a booked sale once it leaves PENDING and isn't canceled. */
const SOLD_STATUSES = ["PROCESSING", "READY_TO_SHIP", "DELIVERING", "DELIVERED", "COMPLETED"] as const;

const DAY_MS = 86_400_000;

/** WHERE clause selecting this org's booked (sold) orders, optional date window. */
function soldWhere(ctx: ServiceCtx, from?: Date, to?: Date): SQL {
  const filters: SQL[] = [
    eq(orders.organizationId, ctx.orgId),
    inArray(orders.status, [...SOLD_STATUSES]),
  ];
  if (from) filters.push(gte(orders.orderDate, from));
  if (to) filters.push(lte(orders.orderDate, to));
  return and(...filters)!;
}

// ---------------- AR aging ----------------

export type AgingRow = {
  company: string;
  current: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
};

/**
 * Accounts-receivable aging: open invoice balances bucketed by age (0-30 /
 * 31-60 / 61-90 / 90+ days) and rolled up per customer company. An invoice ages
 * from its due date (falling back to its issue date); balance nets out payments
 * and applied credits. Distru's collections view.
 */
export async function arAgingByCompany(ctx: ServiceCtx, now = new Date()): Promise<AgingRow[]> {
  const rows = await db
    .select({
      company: sql<string>`coalesce(${companies.name}, '(no customer)')`,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      creditsApplied: invoices.creditsApplied,
      dueDate: invoices.dueDate,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .leftJoin(companies, eq(invoices.customerId, companies.id))
    .where(
      and(
        eq(invoices.organizationId, ctx.orgId),
        eq(invoices.voided, false),
        inArray(invoices.status, ["NOT_PAID", "PARTIALLY_PAID"]),
      ),
    );

  const buckets = new Map<string, AgingRow>();
  for (const r of rows) {
    const balance = Number(r.total) - Number(r.amountPaid) - Number(r.creditsApplied);
    if (balance <= 0) continue;
    const ref = r.dueDate ?? r.issueDate;
    const age = ref ? Math.floor((now.getTime() - new Date(ref).getTime()) / DAY_MS) : 0;
    const b =
      buckets.get(r.company) ??
      { company: r.company, current: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 };
    if (age <= 30) b.current += balance;
    else if (age <= 60) b.d31_60 += balance;
    else if (age <= 90) b.d61_90 += balance;
    else b.d90_plus += balance;
    b.total += balance;
    buckets.set(r.company, b);
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

// ---------------- Margin by product ----------------

export type MarginRow = {
  sku: string;
  name: string;
  quantitySold: number;
  revenue: number;
  cogs: number;
  margin: number;
  marginPct: number;
};

/**
 * Gross margin per product across booked orders: revenue (units x price) minus
 * real COGS captured on each shipped line (`order_items.cogs`, the FIFO cost of
 * the stock consumed). Margin % is margin / revenue.
 */
export async function marginByProduct(ctx: ServiceCtx, from?: Date, to?: Date): Promise<MarginRow[]> {
  const rows = await db
    .select({
      sku: orderItems.sku,
      name: sql<string>`max(${orderItems.name})`,
      quantitySold: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`,
      revenue: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`,
      cogs: sql<string>`coalesce(sum(${orderItems.cogs}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(soldWhere(ctx, from, to))
    .groupBy(orderItems.sku);

  return rows
    .filter((r) => r.sku)
    .map((r) => {
      const revenue = Number(r.revenue);
      const cogs = Number(r.cogs);
      const margin = revenue - cogs;
      return {
        sku: r.sku ?? "",
        name: r.name ?? "",
        quantitySold: Number(r.quantitySold),
        revenue,
        cogs,
        margin,
        marginPct: revenue > 0 ? (margin / revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.margin - a.margin);
}

// ---------------- Sales matrix (product x month) ----------------

export type MatrixMonth = { key: string; label: string; start: Date; end: Date };

/** The last `count` calendar months (oldest first), anchored to `now`. */
export function matrixMonths(count = 6, now = new Date()): MatrixMonth[] {
  const months: MatrixMonth[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const key = `m_${start.getFullYear()}_${String(start.getMonth() + 1).padStart(2, "0")}`;
    const label = start.toLocaleString("en-US", { month: "short", year: "numeric" });
    months.push({ key, label, start, end });
  }
  return months;
}

export type MatrixRow = { sku: string; product: string; total: number } & Record<string, number | string>;

/**
 * The sales matrix: units (default) or revenue per product across the last N
 * months, one column per month plus a row total. Only booked orders count.
 */
export async function salesMatrix(
  ctx: ServiceCtx,
  opts: { months?: MatrixMonth[]; metric?: "units" | "revenue"; now?: Date } = {},
): Promise<MatrixRow[]> {
  const months = opts.months ?? matrixMonths(6, opts.now);
  const metric = opts.metric ?? "units";
  const windowStart = months[0]!.start;
  const windowEnd = months[months.length - 1]!.end;
  const value =
    metric === "revenue"
      ? sql<string>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`
      : sql<string>`sum(${orderItems.quantity})`;
  const rows = await db
    .select({
      sku: orderItems.sku,
      name: sql<string>`max(${orderItems.name})`,
      bucket: sql<string>`to_char(${orders.orderDate}, 'YYYY_MM')`,
      value,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        soldWhere(ctx),
        gte(orders.orderDate, windowStart),
        sql`${orders.orderDate} < ${windowEnd}`,
      ),
    )
    .groupBy(orderItems.sku, sql`to_char(${orders.orderDate}, 'YYYY_MM')`);

  const byProduct = new Map<string, MatrixRow>();
  for (const r of rows) {
    if (!r.sku) continue;
    const row =
      byProduct.get(r.sku) ??
      ({ sku: r.sku, product: r.name ?? "", total: 0, ...Object.fromEntries(months.map((m) => [m.key, 0])) } as MatrixRow);
    const key = `m_${r.bucket}`;
    const v = Number(r.value);
    row[key] = (Number(row[key]) || 0) + v;
    row.total += v;
    byProduct.set(r.sku, row);
  }
  return [...byProduct.values()].sort((a, b) => b.total - a.total);
}

// ---------------- Payments received ----------------

export type PaymentMethodRow = { method: string; paymentCount: number; total: number };

/** Payments received grouped by method (cash, check, ACH, ...) over a window. */
export async function paymentsByMethod(ctx: ServiceCtx, from?: Date, to?: Date): Promise<PaymentMethodRow[]> {
  const filters: SQL[] = [eq(payments.organizationId, ctx.orgId)];
  if (from) filters.push(gte(payments.paidAt, from));
  if (to) filters.push(lte(payments.paidAt, to));
  const rows = await db
    .select({
      method: payments.method,
      paymentCount: sql<string>`count(*)`,
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(...filters))
    .groupBy(payments.method)
    .orderBy(sql`coalesce(sum(${payments.amount}), 0) desc`);
  return rows.map((r) => ({
    method: r.method,
    paymentCount: Number(r.paymentCount),
    total: Number(r.total),
  }));
}

// ---------------- Sales by month (trend) ----------------

export type MonthlySalesRow = { month: string; orderCount: number; unitsSold: number; revenue: number };

/** Booked revenue / units / order count grouped by calendar month (trend). */
export async function salesByMonth(ctx: ServiceCtx, from?: Date, to?: Date): Promise<MonthlySalesRow[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(${orders.orderDate}, 'YYYY-MM')`,
      orderCount: sql<string>`count(distinct ${orders.id})`,
      unitsSold: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`,
      revenue: sql<string>`coalesce(sum(${orderItems.quantity} * ${orderItems.unitPrice}), 0)`,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(soldWhere(ctx, from, to))
    .groupBy(sql`to_char(${orders.orderDate}, 'YYYY-MM')`)
    .orderBy(asc(sql`to_char(${orders.orderDate}, 'YYYY-MM')`));
  return rows.map((r) => ({
    month: r.month,
    orderCount: Number(r.orderCount),
    unitsSold: Number(r.unitsSold),
    revenue: Number(r.revenue),
  }));
}

// ---------------- Low stock / reorder ----------------

/** Default on-hand threshold below which an inventory item flags for reorder. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 50;

export type LowStockRow = {
  sku: string;
  name: string;
  category: string;
  onHand: number;
  threshold: number;
  shortfall: number;
};

/**
 * Products at or below the reorder threshold - the buy list. Only ACTIVE,
 * inventory-tracked products are considered; on-hand is `SUM(ledger delta)`.
 */
export async function lowStock(
  ctx: ServiceCtx,
  threshold = DEFAULT_LOW_STOCK_THRESHOLD,
  onHand?: Map<string, number>,
): Promise<LowStockRow[]> {
  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        eq(products.organizationId, ctx.orgId),
        eq(products.status, "ACTIVE"),
        eq(products.isInventoryItem, true),
      ),
    );

  const onHandMap = onHand ?? (await onHandByProduct(ctx));
  return rows
    .map((r) => {
      const oh = onHandMap.get(r.id) ?? 0;
      return {
        sku: r.sku,
        name: r.name,
        category: r.category,
        onHand: oh,
        threshold,
        shortfall: Math.max(0, threshold - oh),
      };
    })
    .filter((r) => r.onHand < threshold)
    .sort((a, b) => b.shortfall - a.shortfall);
}
