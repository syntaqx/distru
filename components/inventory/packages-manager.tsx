"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { InventorySubnav } from "@/components/inventory/inventory-subnav";

export type PackageRowView = {
  id: string;
  packageTag: string;
  product: string | null;
  quantity: number;
  location: string | null;
  status: string;
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "text-accent",
  INACTIVE: "text-muted",
  FINISHED: "text-info",
  ON_HOLD: "text-warn",
};

export function PackagesManager({ packages }: { packages: PackageRowView[] }) {
  const active = packages.filter((p) => p.status === "ACTIVE").length;
  const totalQty = packages.reduce((a, p) => a + p.quantity, 0);

  return (
    <div>
      <InventorySubnav />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Packages", packages.length],
          ["Active", active],
          ["Total quantity", totalQty.toLocaleString()],
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
        <Link
          href="/inventory/packages/new"
          className="btn btn-primary ml-auto"
        >
          <Plus size={16} /> New package
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr
              className="text-left text-muted"
              style={{ background: "var(--color-surface)" }}
            >
              <th className="px-4 py-2.5 font-medium">Tag</th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 text-right font-medium">Quantity</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr
                key={p.id}
                className="border-t"
                style={{ background: "var(--color-surface)" }}
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/inventory/packages/${p.id}/edit`}
                    className="font-mono text-xs text-info hover:underline"
                  >
                    {p.packageTag}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{p.product ?? "-"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {p.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-2.5">{p.location ?? "-"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`badge text-[10px] ${STATUS_BADGE[p.status] ?? ""}`}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {packages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No packages yet. Create one to track a tagged, Metrc-style unit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
