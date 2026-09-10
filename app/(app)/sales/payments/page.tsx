import Link from "next/link";
import { getOrgContext } from "@/lib/session";
import { listPayments, listInvoices } from "@/lib/modules/sales";
import { SalesSubnav } from "@/components/sales/sales-subnav";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString() : "-";

export default async function PaymentsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items }, { items: invoiceItems }] = await Promise.all([
    listPayments(service, { limit: 200 }),
    listInvoices(service, { limit: 200 }),
  ]);

  // invoiceNumber -> customer name, so each payment shows who paid.
  const customerByInvoice = new Map<string, string>();
  for (const i of invoiceItems) {
    if (i.customer?.name)
      customerByInvoice.set(i.invoice.invoiceNumber, i.customer.name);
  }

  const total = items.reduce((a, p) => a + Number(p.payment.amount), 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Sales</h1>
        <p className="text-sm text-muted">
          Every payment recorded against your invoices.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <SalesSubnav />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
          {[
            ["Payments", items.length],
            ["Collected", money(total)],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="text-xs uppercase tracking-wide text-muted">
                {label}
              </div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Invoice</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Method</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr
                  key={p.payment.id}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5">
                    {p.invoiceNumber ? (
                      <Link
                        href={`/sales/invoices/${p.invoiceNumber}`}
                        className="font-mono text-xs text-info hover:underline"
                      >
                        {p.invoiceNumber}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {(p.invoiceNumber &&
                      customerByInvoice.get(p.invoiceNumber)) ??
                      "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(Number(p.payment.amount))}
                  </td>
                  <td className="px-4 py-2.5 capitalize">{p.payment.method}</td>
                  <td className="px-4 py-2.5">{shortDate(p.payment.paidAt)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No payments recorded yet. Record one from an invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
