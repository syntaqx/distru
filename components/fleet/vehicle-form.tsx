"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { saveVehicleAction, type VehicleForm as VehicleFormData } from "@/app/(app)/fleet/actions";

export function VehicleForm({ initial }: { initial: VehicleFormData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<VehicleFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof VehicleFormData>(k: K, v: VehicleFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveVehicleAction(form);
      if (res.ok) router.push("/fleet");
      else setError(res.error ?? "Could not save vehicle.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.name || "vehicle"}` : "New vehicle"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit ? "Update this vehicle's details." : "Add a vehicle to your fleet."}
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
          <h2 className="mb-3 text-sm font-semibold">Vehicle</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2">
              <label className={label}>Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Van 1"
                autoFocus
              />
            </div>
            <div>
              <label className={label}>Make</label>
              <input className="input" value={form.make ?? ""} onChange={(e) => set("make", e.target.value)} />
            </div>
            <div>
              <label className={label}>Model</label>
              <input className="input" value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={label}>License plate</label>
              <input
                className="input"
                value={form.licensePlate ?? ""}
                onChange={(e) => set("licensePlate", e.target.value)}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/fleet" className="btn btn-outline">Cancel</Link>
        <button className="btn btn-primary" onClick={save} disabled={pending || !form.name?.trim()}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create vehicle"}
        </button>
      </div>
    </div>
  );
}
