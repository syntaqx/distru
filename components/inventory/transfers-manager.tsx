"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { InventorySubnav } from "@/components/inventory/inventory-subnav";

export type TransferRowView = {
  id: string;
  transferNumber: string;
  fromLocation: string | null;
  toLocation: string | null;
  lineCount: number;
  status: string;
  createdAt: string;
};

const money = (n: number) => `$${n.toFixed(2)}`;

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: "text-accent",
  PENDING: "text-muted",
  CANCELED: "text-danger",
};

export function TransfersManager({
  transfers,
  totalMovedCost,
}: {
  transfers: TransferRowView[];
  totalMovedCost: number;
}) {
  const lines = transfers.reduce((a, t) => a + t.lineCount, 0);

  return (
    <div>
      <InventorySubnav />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Transfers", transfers.length.toLocaleString()],
          ["Lines moved", lines.toLocaleString()],
          ["Value moved", money(totalMovedCost)],
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
        <Link href="/inventory/transfers/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New transfer
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr
              className="text-left text-muted"
              style={{ background: "var(--color-surface)" }}
            >
              <th className="px-4 py-2.5 font-medium">Transfer</th>
              <th className="px-4 py-2.5 font-medium">From</th>
              <th className="px-4 py-2.5 font-medium">To</th>
              <th className="px-4 py-2.5 text-right font-medium">Lines</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr
                key={t.id}
                className="border-t"
                style={{ background: "var(--color-surface)" }}
              >
                <td className="px-4 py-2.5 font-mono text-xs">
                  {t.transferNumber}
                </td>
                <td className="px-4 py-2.5">{t.fromLocation ?? "-"}</td>
                <td className="px-4 py-2.5">{t.toLocation ?? "-"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {t.lineCount.toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`badge text-[10px] ${STATUS_BADGE[t.status] ?? ""}`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">{t.createdAt}</td>
              </tr>
            ))}
            {transfers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No transfers yet. Move stock between locations to record one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
