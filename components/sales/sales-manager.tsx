"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CheckCircle2, FileText, Plus, TrendingUp } from "lucide-react";
import {
  cancelOrderAction,
  createInvoiceAction,
  setOrderStatusAction,
} from "@/app/(app)/sales/actions";

export type OrderLine = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
};
export type OrderRow = {
  orderNumber: string;
  status: string;
  customer: string | null;
  itemCount: number;
  total: number;
  orderDate: string;
  /** The invoice raised against this order, if any. */
  invoiceNumber: string | null;
  lines: OrderLine[];
};
export type InvoicePayment = {
  amount: number;
  method: string;
  paidAt: string | null;
};
export type InvoiceRow = {
  invoiceNumber: string;
  status: string;
  voided: boolean;
  customer: string | null;
  total: number;
  amountPaid: number;
  orderNumber: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  lines: OrderLine[];
  payments: InvoicePayment[];
};
export type ProductOption = { sku: string; name: string; unitPrice: number };
export type TopSellerRow = {
  sku: string;
  name: string;
  quantitySold: number;
  revenue: number;
};

const money = (n: number) => `$${n.toFixed(2)}`;

const ORDER_BADGE: Record<string, string> = {
  PENDING: "text-muted",
  PROCESSING: "text-accent",
  READY_TO_SHIP: "text-info",
  DELIVERING: "text-info",
  DELIVERED: "text-info",
  COMPLETED: "text-accent",
  CANCELED: "text-danger",
};
const INVOICE_BADGE: Record<string, string> = {
  NOT_PAID: "text-info",
  PARTIALLY_PAID: "text-warn",
  FULLY_PAID: "text-accent",
  OVER_PAID: "text-warn",
};
/** The forward order lifecycle, for the "advance status" action. */
const ORDER_FLOW = [
  "PENDING",
  "PROCESSING",
  "READY_TO_SHIP",
  "DELIVERING",
  "DELIVERED",
  "COMPLETED",
] as const;

export function SalesManager({
  orders,
  invoices,
  topSellers,
  view = "orders",
}: {
  orders: OrderRow[];
  invoices: InvoiceRow[];
  topSellers: TopSellerRow[];
  /** Which view the Sales sub-nav selected (`?view=`); the tab bar lives in the page. */
  view?: "orders" | "invoices";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tab = view;
  const [error, setError] = useState<string | null>(null);

  const revenue = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((a, o) => a + o.total, 0);
  const outstanding = invoices
    .filter((i) => !i.voided)
    .reduce((a, i) => a + (i.total - i.amountPaid), 0);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Orders", orders.length],
          ["Booked revenue", money(revenue)],
          ["Invoices", invoices.length],
          ["Outstanding", money(outstanding)],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {topSellers.length > 0 && (
        <div className="card mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <TrendingUp size={14} /> Top sellers
          </div>
          <div className="space-y-1.5">
            {topSellers.map((p, idx) => {
              const max = topSellers[0]?.revenue || 1;
              return (
                <div key={p.sku} className="flex items-center gap-3 text-sm">
                  <span className="w-4 text-right tabular-nums text-muted">
                    {idx + 1}
                  </span>
                  <span className="w-40 truncate" title={p.name}>
                    {p.name}
                  </span>
                  <span className="font-mono text-xs text-muted">{p.sku}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
                      style={{ width: `${Math.max(4, (p.revenue / max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-muted">
                    {p.quantitySold} u
                  </span>
                  <span className="w-24 text-right font-medium tabular-nums">
                    {money(p.revenue)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            Ask the Copilot for more: <em>&ldquo;what are our best sellers this
            month?&rdquo;</em> or <em>&ldquo;who owes us money?&rdquo;</em>
          </p>
        </div>
      )}

      <div className="mb-4 flex items-center">
        <h2 className="text-sm font-semibold capitalize">{tab}</h2>
        <Link href="/sales/orders/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New order
        </Link>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      {tab === "orders" ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 text-right font-medium">Items</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.orderNumber}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/sales/orders/${o.orderNumber}`}
                      className="font-mono text-xs text-info hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{o.customer ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`badge text-[10px] ${ORDER_BADGE[o.status] ?? ""}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {o.invoiceNumber ? (
                      <Link
                        href={`/sales/invoices/${o.invoiceNumber}`}
                        className="font-mono text-xs text-info hover:underline"
                        title="View invoice"
                      >
                        {o.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {o.itemCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(o.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {(() => {
                        const idx = ORDER_FLOW.indexOf(o.status as (typeof ORDER_FLOW)[number]);
                        const next = idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1] : null;
                        return next ? (
                          <button
                            className="btn btn-ghost px-2 py-1"
                            title={`Advance to ${next}${o.status === "PENDING" ? " (decrements stock)" : ""}`}
                            aria-label={`Advance order ${o.orderNumber} to ${next}`}
                            disabled={pending}
                            onClick={() => run(() => setOrderStatusAction(o.orderNumber, next))}
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        ) : null;
                      })()}
                      {o.status !== "PENDING" &&
                        o.status !== "CANCELED" &&
                        (o.invoiceNumber ? (
                          <Link
                            href={`/sales/invoices/${o.invoiceNumber}`}
                            className="btn btn-ghost px-2 py-1"
                            title={`View invoice ${o.invoiceNumber}`}
                            aria-label={`View invoice ${o.invoiceNumber}`}
                          >
                            <FileText size={14} />
                          </Link>
                        ) : (
                          <button
                            className="btn btn-ghost px-2 py-1"
                            title="Create invoice"
                            aria-label={`Create invoice for ${o.orderNumber}`}
                            disabled={pending}
                            onClick={() => run(() => createInvoiceAction(o.orderNumber))}
                          >
                            <FileText size={14} />
                          </button>
                        ))}
                      {o.status !== "CANCELED" && o.status !== "COMPLETED" && (
                        <button
                          className="btn btn-ghost px-2 py-1"
                          title="Cancel (restores stock)"
                          aria-label={`Cancel order ${o.orderNumber}`}
                          disabled={pending}
                          onClick={() => run(() => cancelOrderAction(o.orderNumber))}
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No orders yet. Create one, or ask the Copilot:{" "}
                    <em>&ldquo;sell 10 Blue Dream to Green Leaf.&rdquo;</em>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Paid</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr
                  key={i.invoiceNumber}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/sales/invoices/${i.invoiceNumber}`}
                      className="font-mono text-xs text-info hover:underline"
                      title={`View invoice ${i.invoiceNumber}`}
                    >
                      {i.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{i.customer ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`badge text-[10px] ${INVOICE_BADGE[i.status] ?? ""}`}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(i.total)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(i.amountPaid)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(i.total - i.amountPaid)}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No invoices yet. Invoice a confirmed order from the Orders
                    tab.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
