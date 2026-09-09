"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { saveHarvestAction } from "@/app/(app)/cultivation/actions";
import type { HarvestStatus } from "@/components/cultivation/cultivation-manager";
import type { RefOption } from "@/components/cultivation/plant-batch-form";

const STATUSES: HarvestStatus[] = ["ACTIVE", "FINISHED"];

export function HarvestForm({
  strains,
  initial,
}: {
  strains: RefOption[];
  initial?: {
    id: string;
    name: string | null;
    strainId: string | null;
    plantCount: number;
    wetWeight: number | null;
    dryWeight: number | null;
    status: HarvestStatus;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [strainId, setStrainId] = useState(initial?.strainId ?? "");
  const [plantCount, setPlantCount] = useState(String(initial?.plantCount ?? 0));
  const [wetWeight, setWetWeight] = useState(
    initial?.wetWeight != null ? String(initial.wetWeight) : "",
  );
  const [dryWeight, setDryWeight] = useState(
    initial?.dryWeight != null ? String(initial.dryWeight) : "",
  );
  const [status, setStatus] = useState<HarvestStatus>(initial?.status ?? "ACTIVE");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveHarvestAction({
        id: initial?.id,
        name: name.trim() || null,
        strainId: strainId || null,
        plantCount: Number(plantCount) || 0,
        wetWeight: wetWeight.trim() === "" ? null : Number(wetWeight),
        dryWeight: dryWeight.trim() === "" ? null : Number(dryWeight),
        status,
      });
      if (res.ok) router.push("/cultivation");
      else setError(res.error ?? "Could not save harvest.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{initial ? "Edit harvest" : "New harvest"}</h1>
          <p className="text-sm text-muted">
            Record the yield coming off a batch — wet at cut, dry once cured.
          </p>
        </div>
        <Link href="/cultivation" className="btn btn-ghost">
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="card space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional label"
            />
          </div>
          <div>
            <label className={label}>Status</label>
            <Select
              ariaLabel="Status"
              value={status}
              onValueChange={(v) => setStatus(v as HarvestStatus)}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div>
            <label className={label}>Strain</label>
            <Select
              ariaLabel="Strain"
              value={strainId}
              onValueChange={setStrainId}
              placeholder="No strain"
              options={[
                { value: "", label: "No strain" },
                ...strains.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div>
            <label className={label}>Plant count</label>
            <input
              className="input"
              type="number"
              min={0}
              value={plantCount}
              onChange={(e) => setPlantCount(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Wet weight (g)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min={0}
              value={wetWeight}
              onChange={(e) => setWetWeight(e.target.value)}
              placeholder="—"
            />
          </div>
          <div>
            <label className={label}>Dry weight (g)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min={0}
              value={dryWeight}
              onChange={(e) => setDryWeight(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/cultivation" className="btn btn-outline">
          Cancel
        </Link>
        <button className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create harvest"}
        </button>
      </div>
    </div>
  );
}
