"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  saveLicenseAction,
  type LicenseForm as LicenseFormData,
} from "@/app/(app)/compliance/actions";
import { Select } from "@/components/ui/select";

export type Option = { id: string; name: string };

export function LicenseForm({
  initial,
  types,
}: {
  initial: LicenseFormData;
  types: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<LicenseFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof LicenseFormData>(k: K, v: LicenseFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveLicenseAction(form);
      if (res.ok) router.push("/compliance");
      else setError(res.error ?? "Could not save license.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? "Edit license" : "New license"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit
              ? "Update this state license."
              : "Register a state license for your organization."}
          </p>
        </div>
        <Link href="/compliance" className="btn btn-ghost">
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="card">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>License number</label>
            <input
              className="input"
              value={form.licenseNumber}
              onChange={(e) => set("licenseNumber", e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className={label}>License type</label>
            <Select
              ariaLabel="License type"
              value={form.licenseTypeId ?? ""}
              onValueChange={(v) => set("licenseTypeId", v)}
              placeholder="No type"
              options={[
                { value: "", label: "No type" },
                ...types.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>
          <div>
            <label className={label}>State</label>
            <input
              className="input"
              value={form.state ?? ""}
              onChange={(e) => set("state", e.target.value)}
              placeholder="e.g. CA"
            />
          </div>
          <div className="col-span-2">
            <label className={label}>Name / label</label>
            <input
              className="input"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Friendly name (optional)"
            />
          </div>
          <div>
            <label className={label}>Expiry date</label>
            <input
              type="date"
              className="input"
              value={form.expiresAt ?? ""}
              onChange={(e) => set("expiresAt", e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/compliance" className="btn btn-outline">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={pending || !form.licenseNumber?.trim()}
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create license"}
        </button>
      </div>
    </div>
  );
}
