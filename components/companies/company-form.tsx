"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  saveCompanyAction,
  type CompanyForm as CompanyFormData,
} from "@/app/(app)/companies/actions";
import { Select } from "@/components/ui/select";

export type Option = { id: string; name: string };

const ALL_ROLES = ["CUSTOMER", "VENDOR", "BRAND"] as const;

export function CompanyForm({
  initial,
  groups,
}: {
  initial: CompanyFormData;
  groups: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<CompanyFormData>(initial);
  const [tagsText, setTagsText] = useState((initial.tags ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof CompanyFormData>(k: K, v: CompanyFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role],
    }));
  }

  function save() {
    setError(null);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await saveCompanyAction({ ...form, tags });
      if (res.ok && res.id) router.push(`/companies/${res.id}`);
      else setError(res.error ?? "Could not save company.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.name || "company"}` : "New company"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit ? "Update this company's details." : "Add a company to your CRM."}
          </p>
        </div>
        <Link
          href={isEdit ? `/companies/${initial.id}` : "/companies"}
          className="btn btn-ghost"
        >
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="space-y-4">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Identity</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2">
              <label className={label}>Name</label>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </div>
            <div>
              <label className={label}>Company group</label>
              <Select
                ariaLabel="Company group"
                value={form.groupId ?? ""}
                onValueChange={(v) => set("groupId", v)}
                placeholder="No group"
                options={[{ value: "", label: "No group" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
              />
            </div>
            <div>
              <label className={label}>Tags</label>
              <input
                className="input"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="Comma-separated"
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Roles</h2>
          <div className="flex flex-wrap gap-4">
            {ALL_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {role}
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href={isEdit ? `/companies/${initial.id}` : "/companies"} className="btn btn-outline">Cancel</Link>
        <button className="btn btn-primary" onClick={save} disabled={pending || !form.name?.trim() || form.roles.length === 0}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create company"}
        </button>
      </div>
    </div>
  );
}
