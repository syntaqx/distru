"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { deleteCategoryAction } from "@/app/(app)/categories/actions";

export type CategoryRow = {
  id: string;
  name: string;
  biotrackType: string | null;
  productCount: number;
};

export function CategoriesManager({
  rows,
  uncategorizedCount = 0,
}: {
  rows: CategoryRow[];
  uncategorizedCount?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  const filtered = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()),
  );
  const totalProducts = rows.reduce((a, r) => a + r.productCount, 0);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Categories", rows.length],
          ["Products categorized", totalProducts.toLocaleString()],
          ["Uncategorized", uncategorizedCount.toLocaleString()],
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
            placeholder="Search categories..."
          />
        </div>
        <Link href="/categories/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New category
        </Link>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-140 text-sm">
          <thead>
            <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">BioTrack type</th>
              <th className="px-4 py-2.5 text-right font-medium">Products</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                <td className="px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-2">
                    <Tag size={15} className="text-muted" />
                    {r.name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">{r.biotrackType || "-"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.productCount.toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link className="btn btn-ghost px-2 py-1" title="Edit" aria-label={`Edit ${r.name}`} href={`/categories/${r.id}/edit`}>
                      <Pencil size={14} />
                    </Link>
                    <button
                      className="btn btn-ghost px-2 py-1"
                      title="Delete"
                      aria-label={`Delete ${r.name}`}
                      disabled={pending}
                      onClick={() => {
                        const msg = r.productCount
                          ? `Delete "${r.name}"? ${r.productCount} product(s) will become uncategorized.`
                          : `Delete "${r.name}"?`;
                        if (confirm(msg)) run(() => deleteCategoryAction(r.id));
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  No categories. Add one, or create products with a category and it appears here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
