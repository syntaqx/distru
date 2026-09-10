"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { savePlantAction } from "@/app/(app)/cultivation/actions";
import type { PlantPhase } from "@/components/cultivation/cultivation-manager";
import type { RefOption } from "@/components/cultivation/plant-batch-form";

const PHASES: PlantPhase[] = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED", "DESTROYED"];

export function PlantForm({
  strains,
  locations,
  initial,
}: {
  strains: RefOption[];
  locations: RefOption[];
  initial?: {
    id: string;
    plantTag: string;
    strainId: string | null;
    locationId: string | null;
    phase: PlantPhase;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plantTag, setPlantTag] = useState(initial?.plantTag ?? "");
  const [strainId, setStrainId] = useState(initial?.strainId ?? "");
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [phase, setPhase] = useState<PlantPhase>(initial?.phase ?? "VEGETATIVE");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePlantAction({
        id: initial?.id,
        plantTag: plantTag.trim() || undefined,
        strainId: strainId || null,
        locationId: locationId || null,
        phase,
      });
      if (res.ok) router.push("/cultivation");
      else setError(res.error ?? "Could not save plant.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{initial ? "Edit plant" : "New plant"}</h1>
          <p className="text-sm text-muted">
            An individually tracked plant with its own tag and lifecycle phase.
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
            <label className={label}>Plant tag</label>
            <input
              className="input"
              value={plantTag}
              onChange={(e) => setPlantTag(e.target.value)}
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
        </div>
      </section>

      <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/cultivation" className="btn btn-outline">
          Cancel
        </Link>
        <button className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create plant"}
        </button>
      </div>
    </div>
  );
}
