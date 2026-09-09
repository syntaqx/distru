"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CheckCircle2, PackageCheck, Plus } from "lucide-react";
import {
  receivePurchaseOrderAction,
  setPurchaseOrderStatusAction,
} from "@/app/(app)/purchasing/actions";

export type PoRow = {
  poNumber: string;
  status: string;
  vendor: string | null;
  itemCount: number;
  total: number;
  orderDate: string;
};

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (d: string) => new Date(d).toLocaleDateString();

const PO_BADGE: Record<string, string> = {
  DRAFT: "text-muted",
  OPEN: "text-info",
  RECEIVED: "text-accent",
  CANCELED: "text-danger",
};

/** The forward PO lifecycle, for the "advance status" action. */
const PO_FLOW = ["DRAFT", "OPEN", "RECEIVED"] as const;

export function PurchasingManager({ orders }: { orders: PoRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openValue = orders
    .filter((o) => o.status === "DRAFT" || o.status === "OPEN")
    .reduce((a, o) => a + o.total, 0);
  const received = orders.filter((o) => o.status === "RECEIVED").length;

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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Purchase orders", orders.length],
          ["Open value", money(openValue)],
          ["Received", received],
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
        <Link href="/purchasing/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New PO
        </Link>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr
              className="text-left text-muted"
              style={{ background: "var(--color-surface)" }}
            >
              <th className="px-4 py-2.5 font-medium">PO</th>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Items</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const idx = PO_FLOW.indexOf(o.status as (typeof PO_FLOW)[number]);
              const next =
                idx >= 0 && idx < PO_FLOW.length - 1 ? PO_FLOW[idx + 1] : null;
              const canReceive =
                o.status !== "RECEIVED" && o.status !== "CANCELED";
              return (
                <tr
                  key={o.poNumber}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/purchasing/${o.poNumber}`}
                      className="font-mono text-xs text-info hover:underline"
                    >
                      {o.poNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{o.vendor ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`badge text-[10px] ${PO_BADGE[o.status] ?? ""}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {o.itemCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(o.total)}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {shortDate(o.orderDate)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      {next && next !== "RECEIVED" && (
                        <button
                          className="btn btn-ghost px-2 py-1"
                          title={`Advance to ${next}`}
                          aria-label={`Advance PO ${o.poNumber} to ${next}`}
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              setPurchaseOrderStatusAction(o.poNumber, next),
                            )
                          }
                        >
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {canReceive && (
                        <button
                          className="btn btn-ghost px-2 py-1"
                          title="Receive (posts inventory)"
                          aria-label={`Receive PO ${o.poNumber}`}
                          disabled={pending}
                          onClick={() =>
                            run(() => receivePurchaseOrderAction(o.poNumber))
                          }
                        >
                          <PackageCheck size={14} />
                        </button>
                      )}
                      {o.status !== "CANCELED" && (
                        <button
                          className="btn btn-ghost px-2 py-1"
                          title="Cancel (reverses received stock)"
                          aria-label={`Cancel PO ${o.poNumber}`}
                          disabled={pending}
                          onClick={() =>
                            run(() =>
                              setPurchaseOrderStatusAction(
                                o.poNumber,
                                "CANCELED",
                              ),
                            )
                          }
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  No purchase orders yet. Create one, or ask the Copilot:{" "}
                  <em>&ldquo;buy 50 Blue Dream from Emerald Farms at $12.&rdquo;</em>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
