import Link from "next/link";
import { Plus } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { listReturns, getOrder } from "@/lib/modules/sales";
import { SalesSubnav } from "@/components/sales/sales-subnav";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString() : "-";

const RETURN_BADGE: Record<string, string> = {
  DRAFT: "text-muted",
  RECEIVED: "text-accent",
  CANCELED: "text-danger",
};

export default async function ReturnsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const { items } = await listReturns(service, { limit: 200 });

  // Resolve the linked order number for each return (the list row carries only
  // the orderId on the return record).
  const orderIds = [
    ...new Set(
      items
        .map((r) => r.return.orderId)
        .filter((id): id is string => !!id),
    ),
  ];
  const orders = await Promise.all(orderIds.map((id) => getOrder(service, id)));
  const orderNumberById = new Map<string, string>();
  for (const o of orders) if (o) orderNumberById.set(o.order.id, o.order.orderNumber);

  const totalValue = items
    .filter((r) => r.return.status !== "CANCELED")
    .reduce((a, r) => a + r.total, 0);
  const received = items.filter((r) => r.return.status === "RECEIVED").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Sales</h1>
        <p className="text-sm text-muted">
          Returns, credits and payments across your sales orders.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <SalesSubnav />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Returns", items.length],
            ["Received", received],
            ["Return value", money(totalValue)],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="text-xs uppercase tracking-wide text-muted">
                {label}
              </div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <div className="mb-4 flex items-center">
          <Link href="/sales/returns/new" className="btn btn-primary ml-auto">
            <Plus size={16} /> New return
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Return</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const orderNumber = r.return.orderId
                  ? orderNumberById.get(r.return.orderId) ?? null
                  : null;
                return (
                  <tr
                    key={r.return.id}
                    className="border-t"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/sales/returns/${r.return.returnNumber}`}
                        className="font-mono text-xs text-info hover:underline"
                      >
                        {r.return.returnNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{r.customer?.name ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      {orderNumber ? (
                        <Link
                          href={`/sales/orders/${orderNumber}`}
                          className="font-mono text-xs text-info hover:underline"
                        >
                          {orderNumber}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`badge text-[10px] ${RETURN_BADGE[r.return.status] ?? ""}`}
                      >
                        {r.return.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {money(r.total)}
                    </td>
                    <td className="px-4 py-2.5">{shortDate(r.return.returnDate)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No returns yet. Create one from the New return button.
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
