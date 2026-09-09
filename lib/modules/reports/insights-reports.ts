import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryLedger, locations, products } from "@/db/schema";
import { datetime, num, type ServiceCtx } from "@/lib/modules/shared";
import { listProducts } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";
import {
  getOrder,
  lineTotal,
  listInvoices,
  listOrders,
  ORDER_LIFECYCLE,
  salesSummary,
  topCustomers,
  topProducts,
  type InvoiceStatus,
  type OrderStatus,
} from "@/lib/modules/sales";
import { getPurchaseOrder, listPurchaseOrders, type PurchaseOrderStatus } from "@/lib/modules/purchasing";

/**
 * The Insights report registry - the single source of truth for the standard
 * analytical reports. Each report is defined ONCE here (columns + how to compute
 * its rows), and everything reads from it: the public `/reports/*` API routes,
 * the Insights UI list, and `generate_report` (which materialises a report as a
 * durable artifact you can email / upload to Drive). Cross-domain reads live in
 * this reporting context, composing the other modules' public barrels.
 */

export type ReportColumn = { key: string; label: string };
export type ReportRow = Record<string, unknown>;
export type ReportRunOpts = { status?: string; from?: Date; to?: Date };

export type ReportDef = {
  name: string;
  label: string;
  group: string;
  /** API scope required by the public route. */
  scope: string;
  columns: ReportColumn[];
  /** Query-param plumbing the public route exposes (mirrors the OpenAPI fragment). */
  dateField?: string;
  hasStatus?: boolean;
  run: (ctx: ServiceCtx, opts: ReportRunOpts) => Promise<ReportRow[]>;
};

/** Distru report envelope: `data` rows + `meta.columns` + generation time. */
export function reportEnvelope(columns: ReportColumn[], rows: ReportRow[]) {
  return {
    data: rows,
    meta: { columns, date_range: null, generated_datetime: datetime(new Date()) },
  };
}

export function emptyReport() {
  return reportEnvelope([], []);
}

export const REPORT_DEFS: ReportDef[] = [
  // ---------------- Sales ----------------
  {
    name: "sales-by-company",
    label: "Sales by company",
    group: "Sales",
    scope: "companies:read",
    dateField: "order_datetime",
    columns: [
      { key: "company", label: "Company" },
      { key: "order_count", label: "Orders" },
      { key: "revenue", label: "Revenue" },
    ],
    async run(ctx) {
      const rows = await topCustomers(ctx, { limit: 100 });
      return rows.map((r) => ({ company: r.name, order_count: String(r.orderCount), revenue: num(r.revenue) }));
    },
  },
  {
    name: "sales-by-product",
    label: "Sales by product",
    group: "Sales",
    scope: "orders:read",
    dateField: "order_datetime",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "quantity_sold", label: "Quantity Sold" },
      { key: "order_count", label: "Orders" },
      { key: "revenue", label: "Revenue" },
    ],
    async run(ctx) {
      const rows = await topProducts(ctx, { limit: 100 });
      return rows.map((r) => ({
        sku: r.sku,
        product: r.name,
        quantity_sold: num(r.quantitySold),
        order_count: String(r.orderCount),
        revenue: num(r.revenue),
      }));
    },
  },
  {
    name: "sales-by-user",
    label: "Sales by user",
    group: "Sales",
    scope: "orders:read",
    dateField: "order_datetime",
    columns: [
      { key: "user", label: "User" },
      { key: "order_count", label: "Orders" },
      { key: "units_sold", label: "Units Sold" },
      { key: "revenue", label: "Revenue" },
    ],
    async run(ctx) {
      const s = await salesSummary(ctx);
      return s.orderCount
        ? [{ user: "Unassigned", order_count: String(s.orderCount), units_sold: num(s.unitsSold), revenue: num(s.revenue) }]
        : [];
    },
  },
  {
    name: "sales-order-history",
    label: "Sales order history",
    group: "Sales",
    scope: "orders:read",
    hasStatus: true,
    dateField: "order_datetime",
    columns: [
      { key: "order_number", label: "Order Number" },
      { key: "company", label: "Company" },
      { key: "status", label: "Status" },
      { key: "order_datetime", label: "Order Date" },
      { key: "item_count", label: "Items" },
      { key: "total", label: "Total" },
    ],
    async run(ctx, o) {
      const { items } = await listOrders(ctx, {
        status: (o.status as OrderStatus) ?? undefined,
        updatedFrom: o.from,
        updatedTo: o.to,
        limit: 200,
      });
      return items.map((i) => ({
        order_number: i.order.orderNumber,
        company: i.customer?.name ?? null,
        status: i.order.status,
        order_datetime: datetime(i.order.orderDate),
        item_count: String(i.itemCount),
        total: num(i.total),
      }));
    },
  },
  {
    name: "sales-order-item-history",
    label: "Sales order item history",
    group: "Sales",
    scope: "orders:read",
    hasStatus: true,
    dateField: "order_datetime",
    columns: [
      { key: "order_number", label: "Order Number" },
      { key: "company", label: "Company" },
      { key: "order_datetime", label: "Order Date" },
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "quantity", label: "Quantity" },
      { key: "price", label: "Unit Price" },
      { key: "line_total", label: "Line Total" },
    ],
    async run(ctx, o) {
      const { items } = await listOrders(ctx, {
        status: (o.status as OrderStatus) ?? undefined,
        updatedFrom: o.from,
        updatedTo: o.to,
        limit: 50,
      });
      const rows: ReportRow[] = [];
      for (const listed of items) {
        const order = await getOrder(ctx, listed.order.id);
        if (!order) continue;
        for (const item of order.items) {
          rows.push({
            order_number: order.order.orderNumber,
            company: order.customer?.name ?? null,
            order_datetime: datetime(order.order.orderDate),
            sku: item.sku ?? null,
            product: item.name,
            quantity: num(item.quantity),
            price: num(item.unitPrice),
            line_total: num(lineTotal(item)),
          });
        }
      }
      return rows;
    },
  },
  {
    name: "sales-order-tax",
    label: "Sales order tax",
    group: "Sales",
    scope: "orders:read",
    hasStatus: true,
    dateField: "order_datetime",
    columns: [
      { key: "order_number", label: "Order Number" },
      { key: "company", label: "Company" },
      { key: "order_datetime", label: "Order Date" },
      { key: "subtotal", label: "Subtotal" },
      { key: "tax_total", label: "Tax" },
      { key: "total", label: "Total" },
    ],
    async run(ctx, o) {
      const { items } = await listOrders(ctx, {
        status: (o.status as OrderStatus) ?? undefined,
        updatedFrom: o.from,
        updatedTo: o.to,
        limit: 50,
      });
      const rows: ReportRow[] = [];
      for (const listed of items) {
        const order = await getOrder(ctx, listed.order.id);
        if (!order) continue;
        rows.push({
          order_number: order.order.orderNumber,
          company: order.customer?.name ?? null,
          order_datetime: datetime(order.order.orderDate),
          subtotal: num(order.totals.subtotal),
          tax_total: num(order.totals.taxTotal),
          total: num(order.totals.total),
        });
      }
      return rows;
    },
  },
  {
    name: "order-fulfillment",
    label: "Order fulfillment",
    group: "Sales",
    scope: "orders:read",
    columns: [
      { key: "status", label: "Status" },
      { key: "order_count", label: "Orders" },
    ],
    async run(ctx) {
      const statuses: OrderStatus[] = [...ORDER_LIFECYCLE, "CANCELED"];
      const counts = await Promise.all(statuses.map((status) => listOrders(ctx, { status, limit: 1 })));
      return statuses.map((status, i) => ({ status, order_count: String(counts[i].total) }));
    },
  },
  {
    name: "invoice-history",
    label: "Invoice history",
    group: "Sales",
    scope: "orders:read",
    hasStatus: true,
    dateField: "invoice_datetime",
    columns: [
      { key: "invoice_number", label: "Invoice Number" },
      { key: "company", label: "Company" },
      { key: "status", label: "Status" },
      { key: "invoice_datetime", label: "Invoice Date" },
      { key: "due_datetime", label: "Due Date" },
      { key: "subtotal", label: "Subtotal" },
      { key: "tax_total", label: "Tax" },
      { key: "total", label: "Total" },
      { key: "paid_amount", label: "Paid" },
      { key: "balance", label: "Balance" },
    ],
    async run(ctx, o) {
      const { items } = await listInvoices(ctx, {
        status: (o.status as InvoiceStatus) ?? undefined,
        updatedFrom: o.from,
        updatedTo: o.to,
        limit: 200,
      });
      return items.map(({ invoice, customer }) => {
        const balance = Number(invoice.total) - Number(invoice.amountPaid) - Number(invoice.creditsApplied);
        return {
          invoice_number: invoice.invoiceNumber,
          company: customer?.name ?? null,
          status: invoice.status,
          invoice_datetime: datetime(invoice.issueDate),
          due_datetime: datetime(invoice.dueDate),
          subtotal: num(invoice.subtotal),
          tax_total: num(invoice.taxTotal),
          total: num(invoice.total),
          paid_amount: num(invoice.amountPaid),
          balance: num(balance),
        };
      });
    },
  },
  // ---------------- Inventory & COGS ----------------
  {
    name: "cogs",
    label: "Cost of goods sold",
    group: "Inventory & COGS",
    scope: "manufacturing:read",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "quantity_sold", label: "Quantity Sold" },
      { key: "unit_cost", label: "Unit Cost" },
      { key: "total_cogs", label: "Total COGS" },
    ],
    async run(ctx) {
      const [sold, prods] = await Promise.all([
        topProducts(ctx, { limit: 100, by: "quantity" }),
        listProducts(ctx, { limit: 200 }),
      ]);
      const costBySku = new Map(prods.items.map((p) => [p.product.sku, Number(p.product.unitPrice ?? 0)]));
      return sold.map((r) => {
        const unitCost = costBySku.get(r.sku) ?? 0;
        return {
          sku: r.sku,
          product: r.name,
          quantity_sold: num(r.quantitySold),
          unit_cost: num(unitCost),
          total_cogs: num(r.quantitySold * unitCost),
        };
      });
    },
  },
  {
    name: "inventory-valuation",
    label: "Inventory valuation",
    group: "Inventory & COGS",
    scope: "inventory:read",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "on_hand", label: "On Hand" },
      { key: "unit_price", label: "Unit Price" },
      { key: "total_value", label: "Total Value" },
    ],
    async run(ctx) {
      const [prods, onHand] = await Promise.all([listProducts(ctx, { limit: 200 }), onHandByProduct(ctx)]);
      return prods.items.map((p) => {
        const qty = onHand.get(p.product.id) ?? 0;
        const price = Number(p.product.unitPrice ?? 0);
        return {
          sku: p.product.sku,
          product: p.product.name,
          on_hand: num(qty),
          unit_price: num(price),
          total_value: num(qty * price),
        };
      });
    },
  },
  {
    name: "inventory-assets",
    label: "Inventory assets",
    group: "Inventory & COGS",
    scope: "inventory:read",
    columns: [
      { key: "category", label: "Category" },
      { key: "product_count", label: "Products" },
      { key: "on_hand", label: "On Hand" },
      { key: "total_value", label: "Total Value" },
    ],
    async run(ctx) {
      const [prods, onHand] = await Promise.all([listProducts(ctx, { limit: 200 }), onHandByProduct(ctx)]);
      const buckets = new Map<string, { count: number; onHand: number; value: number }>();
      for (const p of prods.items) {
        const category = p.category?.name ?? "Uncategorized";
        const qty = onHand.get(p.product.id) ?? 0;
        const b = buckets.get(category) ?? { count: 0, onHand: 0, value: 0 };
        b.count += 1;
        b.onHand += qty;
        b.value += qty * Number(p.product.unitPrice ?? 0);
        buckets.set(category, b);
      }
      return [...buckets.entries()].map(([category, b]) => ({
        category,
        product_count: String(b.count),
        on_hand: num(b.onHand),
        total_value: num(b.value),
      }));
    },
  },
  {
    name: "inventory-transaction-history",
    label: "Inventory transaction history",
    group: "Inventory & COGS",
    scope: "inventory:read",
    columns: [
      { key: "datetime", label: "Date" },
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "location", label: "Location" },
      { key: "quantity_delta", label: "Quantity Change" },
      { key: "reason", label: "Reason" },
      { key: "actor", label: "Actor" },
    ],
    async run(ctx) {
      const rows = await db
        .select({
          createdAt: inventoryLedger.createdAt,
          quantityDelta: inventoryLedger.quantityDelta,
          reason: inventoryLedger.reason,
          actor: inventoryLedger.actor,
          sku: products.sku,
          productName: products.name,
          locationName: locations.name,
        })
        .from(inventoryLedger)
        .leftJoin(products, eq(inventoryLedger.productId, products.id))
        .leftJoin(locations, eq(inventoryLedger.locationId, locations.id))
        .where(and(eq(inventoryLedger.organizationId, ctx.orgId)))
        .orderBy(desc(inventoryLedger.createdAt))
        .limit(200);
      return rows.map((r) => ({
        datetime: datetime(r.createdAt),
        sku: r.sku ?? null,
        product: r.productName ?? null,
        location: r.locationName ?? null,
        quantity_delta: num(r.quantityDelta),
        reason: r.reason,
        actor: r.actor,
      }));
    },
  },
  // ---------------- Purchasing ----------------
  {
    name: "purchase-order-history",
    label: "Purchase order history",
    group: "Purchasing",
    scope: "orders:read",
    hasStatus: true,
    dateField: "order_datetime",
    columns: [
      { key: "po_number", label: "PO Number" },
      { key: "vendor", label: "Vendor" },
      { key: "status", label: "Status" },
      { key: "order_datetime", label: "Order Date" },
      { key: "item_count", label: "Items" },
      { key: "total", label: "Total" },
    ],
    async run(ctx, o) {
      const { items } = await listPurchaseOrders(ctx, {
        status: (o.status as PurchaseOrderStatus) ?? undefined,
        updatedFrom: o.from,
        updatedTo: o.to,
        limit: 200,
      });
      return items.map((i) => ({
        po_number: i.purchaseOrder.poNumber,
        vendor: i.vendor?.name ?? null,
        status: i.purchaseOrder.status,
        order_datetime: datetime(i.purchaseOrder.orderDate),
        item_count: String(i.itemCount),
        total: num(i.total),
      }));
    },
  },
  {
    name: "purchases-by-company",
    label: "Purchases by company",
    group: "Purchasing",
    scope: "companies:read",
    columns: [
      { key: "vendor", label: "Vendor" },
      { key: "po_count", label: "Purchase Orders" },
      { key: "total", label: "Total Purchased" },
    ],
    async run(ctx) {
      const { items } = await listPurchaseOrders(ctx, { limit: 200 });
      const buckets = new Map<string, { count: number; total: number }>();
      for (const i of items) {
        const vendor = i.vendor?.name ?? "(no vendor)";
        const b = buckets.get(vendor) ?? { count: 0, total: 0 };
        b.count += 1;
        b.total += i.total;
        buckets.set(vendor, b);
      }
      return [...buckets.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([vendor, b]) => ({ vendor, po_count: String(b.count), total: num(b.total) }));
    },
  },
  {
    name: "purchases-by-product",
    label: "Purchases by product",
    group: "Purchasing",
    scope: "orders:read",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product", label: "Product" },
      { key: "quantity_purchased", label: "Quantity Purchased" },
      { key: "po_count", label: "Purchase Orders" },
      { key: "total_cost", label: "Total Cost" },
    ],
    async run(ctx) {
      const { items } = await listPurchaseOrders(ctx, { limit: 50 });
      const buckets = new Map<string, { name: string; quantity: number; cost: number; pos: Set<string> }>();
      for (const listed of items) {
        const po = await getPurchaseOrder(ctx, listed.purchaseOrder.id);
        if (!po) continue;
        for (const item of po.items) {
          const key = item.sku ?? item.name;
          const b = buckets.get(key) ?? { name: item.name, quantity: 0, cost: 0, pos: new Set<string>() };
          b.quantity += Number(item.quantity);
          b.cost += Number(item.quantity) * Number(item.unitCost);
          b.pos.add(po.purchaseOrder.id);
          buckets.set(key, b);
        }
      }
      return [...buckets.entries()]
        .sort((a, b) => b[1].cost - a[1].cost)
        .map(([sku, b]) => ({
          sku,
          product: b.name,
          quantity_purchased: num(b.quantity),
          po_count: String(b.pos.size),
          total_cost: num(b.cost),
        }));
    },
  },
  // ---------------- Cultivation (no data surfaced in this clone) ----------------
  {
    name: "cultivation-transaction-history",
    label: "Cultivation transaction history",
    group: "Cultivation",
    scope: "manufacturing:read",
    columns: [],
    async run() {
      return [];
    },
  },
  {
    name: "harvest-outputs",
    label: "Harvest outputs",
    group: "Cultivation",
    scope: "manufacturing:read",
    columns: [],
    async run() {
      return [];
    },
  },
  {
    name: "plant-lifecycle",
    label: "Plant lifecycle",
    group: "Cultivation",
    scope: "manufacturing:read",
    columns: [],
    async run() {
      return [];
    },
  },
];

const BY_NAME = new Map(REPORT_DEFS.map((d) => [d.name, d]));

export function getReportDef(name: string): ReportDef | undefined {
  return BY_NAME.get(name);
}

export function listReportDefs(): ReportDef[] {
  return REPORT_DEFS;
}

/** Render report rows as CSV / a markdown table / JSON - the shared formatter. */
export function formatReport(
  columns: ReportColumn[],
  rows: ReportRow[],
  format: "csv" | "markdown" | "json",
): string {
  const cell = (v: unknown) => (v == null ? "" : String(v));
  if (format === "json") return JSON.stringify({ columns, data: rows }, null, 2);
  if (format === "csv") {
    const esc = (v: unknown) => {
      const s = cell(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      columns.map((c) => esc(c.label)).join(","),
      ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(",")),
    ].join("\n");
  }
  const head = `| ${columns.map((c) => c.label).join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${columns.map((c) => cell(r[c.key]).replace(/\|/g, "\\|")).join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

/** Run a report by name, returning its columns + computed rows (or null). */
export async function runReport(
  ctx: ServiceCtx,
  name: string,
  opts: ReportRunOpts = {},
): Promise<{ columns: ReportColumn[]; rows: ReportRow[] } | null> {
  const def = getReportDef(name);
  if (!def) return null;
  return { columns: def.columns, rows: await def.run(ctx, opts) };
}
