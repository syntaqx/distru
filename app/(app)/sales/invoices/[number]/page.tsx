import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { getInvoiceByNumber, getOrder } from "@/lib/modules/sales";
import { PaymentForm } from "@/components/sales/payment-form";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString() : "-";

const INVOICE_BADGE: Record<string, string> = {
  NOT_PAID: "text-info",
  PARTIALLY_PAID: "text-warn",
  FULLY_PAID: "text-accent",
  OVER_PAID: "text-warn",
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };
  const { number } = await params;
  const invoiceNumber = decodeURIComponent(number);
  const inv = await getInvoiceByNumber(service, invoiceNumber);
  if (!inv) notFound();

  const order = inv.invoice.orderId
    ? await getOrder(service, inv.invoice.orderId)
    : null;

  const total = Number(inv.invoice.total);
  const amountPaid = Number(inv.invoice.amountPaid);
  const balance = total - amountPaid;
  const status = inv.invoice.status;
  const canPay =
    !inv.invoice.voided && status !== "FULLY_PAID" && status !== "OVER_PAID";

  const facts: [string, ReactNode][] = [
    ["Customer", inv.customer?.name ?? "-"],
    [
      "Order",
      order ? (
        <Link
          href={`/sales/orders/${order.order.orderNumber}`}
          className="font-mono text-info hover:underline"
        >
          {order.order.orderNumber}
        </Link>
      ) : (
        "-"
      ),
    ],
    ["Issued", shortDate(inv.invoice.issueDate)],
    ["Due", shortDate(inv.invoice.dueDate)],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            className="btn btn-ghost px-2"
            title="Back to sales"
            aria-label="Back to sales"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <h1 className="font-mono text-lg font-semibold">
              {inv.invoice.invoiceNumber}
            </h1>
            <span
              className={`badge text-[10px] ${INVOICE_BADGE[status] ?? ""}`}
            >
              {status}
            </span>
            {inv.invoice.voided && (
              <span className="badge text-[10px] text-danger">VOIDED</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Details</h2>
            <dl className="grid gap-y-3 text-sm sm:grid-cols-2">
              {facts.map(([k, v], idx) => (
                <div key={idx}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Line items</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-left text-muted"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Qty × Unit
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order?.items.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2">{l.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted">
                        {l.sku ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {Number(l.quantity)} × {money(Number(l.unitPrice))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(Number(l.quantity) * Number(l.unitPrice))}
                      </td>
                    </tr>
                  ))}
                  {!order?.items.length && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-muted"
                      >
                        No line items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Totals</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Total</span>
                <span className="tabular-nums">{money(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Paid</span>
                <span className="tabular-nums">{money(amountPaid)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Balance due</span>
                <span className="tabular-nums">{money(balance)}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Payments</h2>
            {inv.payments.length === 0 ? (
              <p className="text-sm text-muted">No payments yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {inv.payments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span className="text-muted">
                      {shortDate(p.paidAt)} · {p.method}
                    </span>
                    <span className="tabular-nums">
                      {money(Number(p.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {canPay && (
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold">Record payment</h2>
              <PaymentForm
                invoiceNumber={inv.invoice.invoiceNumber}
                balance={balance}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
