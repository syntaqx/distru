"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteCompanyAction } from "@/app/(app)/companies/actions";

export type CompanyRow = { id: string; name: string; roles: string[] };

const ROLE_STYLE: Record<string, string> = {
  CUSTOMER: "var(--color-info)",
  VENDOR: "var(--color-accent)",
  BRAND: "var(--color-warn)",
};

export function CompaniesManager({ rows }: { rows: CompanyRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filtered = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()),
  );
  const count = (role: string) =>
    rows.filter((c) => c.roles.includes(role)).length;

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
          ["Total", rows.length],
          ["Customers", count("CUSTOMER")],
          ["Vendors", count("VENDOR")],
          ["Brands", count("BRAND")],
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
            placeholder="Search companies..."
          />
        </div>
        <Link href="/companies/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New company
        </Link>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-140 text-sm">
          <thead>
            <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Roles</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                <td className="px-4 py-2.5 font-medium">
                  <Link href={`/companies/${r.id}`} className="inline-flex items-center gap-2 hover:underline">
                    <Building2 size={15} className="text-muted" />
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex flex-wrap gap-1.5">
                    {r.roles.map((role) => (
                      <span key={role} className="badge" style={{ color: ROLE_STYLE[role] ?? undefined }}>
                        {role}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Link className="btn btn-ghost px-2 py-1" href={`/companies/${r.id}/edit`} title="Edit" aria-label={`Edit ${r.name}`}>
                      <Pencil size={14} />
                    </Link>
                    <button
                      className="btn btn-ghost px-2 py-1"
                      title="Delete"
                      aria-label={`Delete ${r.name}`}
                      disabled={pending}
                      onClick={() => {
                        if (
                          confirm(`Delete "${r.name}"? Products keep their data but lose this vendor link.`)
                        )
                          run(() => deleteCompanyAction(r.id));
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
                <td colSpan={3} className="px-4 py-10 text-center text-muted">
                  No companies. Add one, or ask the Copilot to import a customer or vendor list.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
