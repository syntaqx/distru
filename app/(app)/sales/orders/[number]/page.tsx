import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { getOrderByNumber, listInvoices, orderTotal } from "@/lib/modules/sales";
import { OrderActions } from "@/components/sales/order-actions";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString() : "-";

const ORDER_BADGE: Record<string, string> = {
  PENDING: "text-muted",
  PROCESSING: "text-accent",
  READY_TO_SHIP: "text-info",
  DELIVERING: "text-info",
  DELIVERED: "text-info",
  COMPLETED: "text-accent",
  CANCELED: "text-danger",
};

export default async function OrderDetailPage({
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
  const orderNumber = decodeURIComponent(number);
  const o = await getOrderByNumber(service, orderNumber);
  if (!o) notFound();

  // Find the invoice raised against this order, if any.
  const { items: invoiceItems } = await listInvoices(service, { limit: 200 });
  const invoiceNumber: string | null =
    invoiceItems.find((i) => i.invoice.orderId === o.order.id)?.invoice
      .invoiceNumber ?? null;

  const total = orderTotal(o.items);

  const facts: [string, ReactNode][] = [
    ["Customer", o.customer?.name ?? "-"],
    [
      "Status",
      <span
        key="status"
        className={`badge text-[10px] ${ORDER_BADGE[o.order.status] ?? ""}`}
      >
        {o.order.status}
      </span>,
    ],
    ["Order date", shortDate(o.order.orderDate)],
    [
      "Invoice",
      invoiceNumber ? (
        <Link
          href={`/sales/invoices/${invoiceNumber}`}
          className="font-mono text-info hover:underline"
        >
          {invoiceNumber}
        </Link>
      ) : (
        "-"
      ),
    ],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-6 py-4">
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
            <h1 className="font-mono text-lg font-semibold">
              {o.order.orderNumber}
            </h1>
            <span
              className={`badge text-[10px] ${ORDER_BADGE[o.order.status] ?? ""}`}
            >
              {o.order.status}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
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
                  {o.items.map((l) => (
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
                  {o.items.length === 0 && (
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
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className="px-3 py-2" colSpan={3}>
                      Order total
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {money(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Actions</h2>
            <OrderActions
              orderNumber={o.order.orderNumber}
              status={o.order.status}
              invoiceNumber={invoiceNumber}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
