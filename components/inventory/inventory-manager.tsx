"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ImageOff, Pencil, Plus, RotateCcw, Search } from "lucide-react";
import { archiveProductAction, restoreProductAction } from "@/app/(app)/inventory/actions";

export type Row = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  vendor: string | null;
  unitType: string | null;
  unitPrice: string | null;
  trackingMethod: "PACKAGE" | "PRODUCT" | "BATCH";
  status: string;
  onHand: number;
  imageUrl: string | null;
};

export function InventoryManager({
  rows,
  categories,
  vendors,
  initialQuery = "",
}: {
  rows: Row[];
  categories: string[];
  vendors: string[];
  unitTypes?: string[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(initialQuery);
  const [error, setError] = useState<string | null>(null);

  const filtered = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.sku.toLowerCase().includes(q.toLowerCase()),
  );
  const totalUnits = rows.reduce((a, r) => a + r.onHand, 0);

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
          ["Products", rows.length],
          ["Units on hand", totalUnits.toLocaleString()],
          ["Categories", categories.length],
          ["Vendors / Brands", vendors.length],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or SKU…"
          />
        </div>
        <Link href="/inventory/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New product
        </Link>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium">Unit</th>
              <th className="px-4 py-2.5 text-right font-medium">Price</th>
              <th className="px-4 py-2.5 text-right font-medium">On hand</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                <td className="px-4 py-2.5">
                  <Link href={`/inventory/${r.id}`} className="flex items-center gap-2.5 hover:text-info">
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded border bg-surface2 text-muted">
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff size={13} />
                      )}
                    </span>
                    <span className="font-medium">{r.name}</span>
                    {r.status === "ARCHIVED" && <span className="badge text-[10px] text-muted">Archived</span>}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.sku}</td>
                <td className="px-4 py-2.5">{r.category ?? "-"}</td>
                <td className="px-4 py-2.5">{r.vendor ?? "-"}</td>
                <td className="px-4 py-2.5">{r.unitType ?? "-"}</td>
                <td className="px-4 py-2.5 text-right">{r.unitPrice ? `$${Number(r.unitPrice).toFixed(2)}` : "-"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.onHand.toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link className="btn btn-ghost px-2 py-1" title="Edit" aria-label={`Edit ${r.name}`} href={`/inventory/${r.id}/edit`}>
                      <Pencil size={14} />
                    </Link>
                    {r.status === "ARCHIVED" ? (
                      <button className="btn btn-ghost px-2 py-1" title="Restore" aria-label={`Restore ${r.name}`} disabled={pending} onClick={() => run(() => restoreProductAction(r.id))}>
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <button className="btn btn-ghost px-2 py-1" title="Archive" aria-label={`Archive ${r.name}`} disabled={pending} onClick={() => run(() => archiveProductAction(r.id))}>
                        <Archive size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No products. Add one, or ask the Copilot to import a catalog.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
