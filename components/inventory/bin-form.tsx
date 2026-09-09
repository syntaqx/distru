"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  saveBinAction,
  type BinForm as BinFormData,
} from "@/app/(app)/inventory/depth-actions";
import { Select } from "@/components/ui/select";

export type LocationOption = { id: string; name: string };

export function BinForm({
  initial,
  locations,
}: {
  initial: BinFormData;
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BinFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof BinFormData>(k: K, v: BinFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveBinAction(form);
      if (res.ok) router.push("/inventory/bins");
      else setError(res.error ?? "Could not save bin.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.name || "bin"}` : "New bin"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit
              ? "Update this storage position."
              : "Add a shelf or slot within a location."}
          </p>
        </div>
        <Link href="/inventory/bins" className="btn btn-ghost">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Bin name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="A-01"
                autoFocus
              />
            </div>
            <div className="col-span-2">
              <label className={label}>Location</label>
              <Select
                ariaLabel="Location"
                value={form.locationId ?? ""}
                onValueChange={(v) => set("locationId", v)}
                placeholder="No location"
                options={[
                  { value: "", label: "No location" },
                  ...locations.map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/inventory/bins" className="btn btn-outline">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={pending || !form.name?.trim()}
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create bin"}
        </button>
      </div>
    </div>
  );
}
