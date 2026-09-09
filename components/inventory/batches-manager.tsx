"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { InventorySubnav } from "@/components/inventory/inventory-subnav";

export type BatchRowView = {
  id: string;
  batchNumber: string;
  product: string | null;
  createdAt: string | null;
};

export function BatchesManager({ batches }: { batches: BatchRowView[] }) {
  const linked = batches.filter((b) => b.product).length;

  return (
    <div>
      <InventorySubnav />

      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          ["Batches", batches.length],
          ["Linked to a product", linked],
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
        <Link href="/inventory/batches/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New batch
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr
              className="text-left text-muted"
              style={{ background: "var(--color-surface)" }}
            >
              <th className="px-4 py-2.5 font-medium">Batch number</th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr
                key={b.id}
                className="border-t"
                style={{ background: "var(--color-surface)" }}
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/inventory/batches/${b.id}/edit`}
                    className="font-mono text-xs text-info hover:underline"
                  >
                    {b.batchNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{b.product ?? "-"}</td>
                <td className="px-4 py-2.5 text-muted">
                  {b.createdAt
                    ? new Date(b.createdAt).toLocaleDateString()
                    : "-"}
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted">
                  No batches yet. Create a production or harvest lot to derive
                  packages from.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
