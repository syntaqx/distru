"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { InventorySubnav } from "@/components/inventory/inventory-subnav";

export type BinRowView = {
  id: string;
  name: string;
  location: string | null;
};

export function BinsManager({ bins }: { bins: BinRowView[] }) {
  const placed = bins.filter((b) => b.location).length;

  return (
    <div>
      <InventorySubnav />

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          ["Bins", bins.length],
          ["Assigned to a location", placed],
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
        <Link href="/inventory/bins/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New bin
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr
              className="text-left text-muted"
              style={{ background: "var(--color-surface)" }}
            >
              <th className="px-4 py-2.5 font-medium">Bin</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((b) => (
              <tr
                key={b.id}
                className="border-t"
                style={{ background: "var(--color-surface)" }}
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/inventory/bins/${b.id}/edit`}
                    className="font-medium text-info hover:underline"
                  >
                    {b.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{b.location ?? "-"}</td>
              </tr>
            ))}
            {bins.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10 text-center text-muted">
                  No bins yet. Create shelves or slots to organize stock within a
                  location.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
