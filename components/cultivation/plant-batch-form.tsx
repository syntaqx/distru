"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { savePlantBatchAction } from "@/app/(app)/cultivation/actions";
import type { PlantPhase } from "@/components/cultivation/cultivation-manager";

export type RefOption = { id: string; name: string };

const PHASES: PlantPhase[] = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED", "DESTROYED"];

export function PlantBatchForm({
  strains,
  locations,
  initial,
}: {
  strains: RefOption[];
  locations: RefOption[];
  initial?: {
    id: string;
    batchNumber: string;
    strainId: string | null;
    locationId: string | null;
    count: number;
    phase: PlantPhase;
    sourceType: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [batchNumber, setBatchNumber] = useState(initial?.batchNumber ?? "");
  const [strainId, setStrainId] = useState(initial?.strainId ?? "");
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [count, setCount] = useState(String(initial?.count ?? 0));
  const [phase, setPhase] = useState<PlantPhase>(initial?.phase ?? "IMMATURE");
  const [sourceType, setSourceType] = useState(initial?.sourceType ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePlantBatchAction({
        id: initial?.id,
        batchNumber: batchNumber.trim() || undefined,
        strainId: strainId || null,
        locationId: locationId || null,
        count: Number(count) || 0,
        phase,
        sourceType: sourceType.trim() || null,
      });
      if (res.ok) router.push("/cultivation");
      else setError(res.error ?? "Could not save plant batch.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {initial ? "Edit plant batch" : "New plant batch"}
          </h1>
          <p className="text-sm text-muted">
            A batch groups plants of one strain moving through the grow together.
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Batch number</label>
            <input
              className="input"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="Auto-generated if blank"
            />
          </div>
          <div>
            <label className={label}>Phase</label>
            <Select
              ariaLabel="Phase"
              value={phase}
              onValueChange={(v) => setPhase(v as PlantPhase)}
              options={PHASES.map((p) => ({ value: p, label: p }))}
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
            <label className={label}>Location</label>
            <Select
              ariaLabel="Location"
              value={locationId}
              onValueChange={setLocationId}
              placeholder="No location"
              options={[
                { value: "", label: "No location" },
                ...locations.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
          <div>
            <label className={label}>Plant count</label>
            <input
              className="input"
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Source type</label>
            <input
              className="input"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              placeholder="e.g. CLONE, SEED"
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/cultivation" className="btn btn-outline">
          Cancel
        </Link>
        <button className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create plant batch"}
        </button>
      </div>
    </div>
  );
}
