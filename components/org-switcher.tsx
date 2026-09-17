"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import {
  organization,
  useActiveOrganization,
  useListOrganizations,
} from "@/lib/auth-client";

function initials(name?: string | null) {
  return (
    (name ?? "")
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "D"
  );
}

export function OrgSwitcher({ initialName }: { initialName: string }) {
  const router = useRouter();
  const { data: active } = useActiveOrganization();
  const { data: orgs } = useListOrganizations();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const activeName = active?.name ?? initialName;
  const list = (orgs ?? []).filter((o) =>
    o.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  async function switchTo(id: string) {
    if (id === active?.id) return setOpen(false);
    setBusy(true);
    await organization.setActive({ organizationId: id });
    setOpen(false);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="relative w-full">
      <div className="flex w-full items-center gap-1">
        <button
          onClick={() => router.push("/dashboard")}
          title="Go to dashboard"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface2"
        >
          <span
            className="grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold"
            style={{ background: "var(--color-accent)", color: "var(--color-accentfg)" }}
          >
            {initials(activeName)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{activeName}</span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Switch workspace"
          aria-expanded={open}
          title="Switch workspace"
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface2"
        >
          <ChevronsUpDown size={14} />
        </button>
      </div>

      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border p-1.5 shadow-lg" style={{ background: "var(--color-surface)" }}>
            <div className="relative mb-1">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search workspaces…"
                className="input py-1.5 pl-8 text-sm"
              />
            </div>
            <div className="max-h-64 overflow-auto">
              {list.map((o) => (
                <button
                  key={o.id}
                  onClick={() => switchTo(o.id)}
                  disabled={busy}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface2"
                >
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold"
                    style={{ background: "var(--color-surface2)", color: "var(--color-muted)" }}
                  >
                    {initials(o.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  {o.id === active?.id && <Check size={15} style={{ color: "var(--color-accent)" }} />}
                </button>
              ))}
              {list.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-muted">No workspaces match.</div>
              )}
            </div>
            <div className="my-1 border-t" />
            <div
              title="Coming soon"
              className="flex cursor-not-allowed items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted opacity-60"
            >
              <Plus size={15} /> Create workspace
              <span className="badge ml-auto text-[10px]">Soon</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
