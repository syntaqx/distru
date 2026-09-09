"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { saveDriverAction, type DriverForm as DriverFormData } from "@/app/(app)/fleet/actions";

export function DriverForm({ initial }: { initial: DriverFormData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<DriverFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof DriverFormData>(k: K, v: DriverFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveDriverAction(form);
      if (res.ok) router.push("/fleet");
      else setError(res.error ?? "Could not save driver.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.name || "driver"}` : "New driver"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit ? "Update this driver's details." : "Add a driver to your fleet."}
          </p>
        </div>
        <Link href="/fleet" className="btn btn-ghost">
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Driver</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Name</label>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input
                className="input"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className={label}>License number</label>
              <input
                className="input"
                value={form.licenseNumber ?? ""}
                onChange={(e) => set("licenseNumber", e.target.value)}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/fleet" className="btn btn-outline">Cancel</Link>
        <button className="btn btn-primary" onClick={save} disabled={pending || !form.name?.trim()}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create driver"}
        </button>
      </div>
    </div>
  );
}
