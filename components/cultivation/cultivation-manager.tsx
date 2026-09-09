"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Leaf, Plus, Scissors, Sprout } from "lucide-react";
import { movePlantPhaseAction } from "@/app/(app)/cultivation/actions";

export type PlantPhase =
  | "IMMATURE"
  | "VEGETATIVE"
  | "FLOWERING"
  | "HARVESTED"
  | "DESTROYED";
export type HarvestStatus = "ACTIVE" | "FINISHED";

export type PlantBatchRow = {
  id: string;
  batchNumber: string;
  strainName: string | null;
  locationName: string | null;
  count: number;
  phase: PlantPhase;
  plantedDate: string | null;
};
export type PlantRow = {
  id: string;
  plantTag: string;
  strainName: string | null;
  locationName: string | null;
  phase: PlantPhase;
  plantedDate: string | null;
};
export type HarvestRow = {
  id: string;
  harvestNumber: string;
  name: string | null;
  strainName: string | null;
  plantCount: number;
  wetWeight: number | null;
  dryWeight: number | null;
  status: HarvestStatus;
};

const PHASE_BADGE: Record<PlantPhase, string> = {
  IMMATURE: "text-muted",
  VEGETATIVE: "text-info",
  FLOWERING: "text-accent",
  HARVESTED: "text-warn",
  DESTROYED: "text-danger",
};
const STATUS_BADGE: Record<HarvestStatus, string> = {
  ACTIVE: "text-info",
  FINISHED: "text-accent",
};
/** Forward lifecycle for the phase-advance action (DESTROYED is a manual terminal). */
const PHASE_FLOW: PlantPhase[] = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED"];

const dateOf = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "-");

export function CultivationManager({
  plantBatches,
  plants,
  harvests,
}: {
  plantBatches: PlantBatchRow[];
  plants: PlantRow[];
  harvests: HarvestRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"batches" | "plants" | "harvests">("batches");
  const [error, setError] = useState<string | null>(null);

  const livingPlants = plants.filter(
    (p) => p.phase !== "HARVESTED" && p.phase !== "DESTROYED",
  ).length;
  const activeHarvests = harvests.filter((h) => h.status === "ACTIVE").length;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  const newHref =
    tab === "batches"
      ? "/cultivation/plant-batches/new"
      : tab === "plants"
        ? "/cultivation/plants/new"
        : "/cultivation/harvests/new";
  const newLabel =
    tab === "batches" ? "New plant batch" : tab === "plants" ? "New plant" : "New harvest";

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          ["Plant batches", plantBatches.length, <Sprout key="s" size={14} />],
          ["Living plants", livingPlants, <Leaf key="l" size={14} />],
          ["Active harvests", activeHarvests, <Scissors key="h" size={14} />],
        ].map(([label, value, icon]) => (
          <div key={label as string} className="card">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
              {icon} {label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex rounded-lg border p-0.5"
          style={{ background: "var(--color-surface)" }}
        >
          {(
            [
              ["batches", "Plant batches"],
              ["plants", "Plants"],
              ["harvests", "Harvests"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === t ? "text-fg" : "text-muted hover:text-fg"
              }`}
              style={tab === t ? { background: "var(--color-surface2)" } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        <Link href={newHref} className="btn btn-primary ml-auto">
          <Plus size={16} /> {newLabel}
        </Link>
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      {tab === "batches" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Batch</th>
                <th className="px-4 py-2.5 font-medium">Strain</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Phase</th>
                <th className="px-4 py-2.5 text-right font-medium">Count</th>
                <th className="px-4 py-2.5 font-medium">Planted</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {plantBatches.map((b) => (
                <tr key={b.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/cultivation/plant-batches/${b.id}/edit`}
                      className="font-mono text-xs text-info hover:underline"
                    >
                      {b.batchNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{b.strainName ?? "-"}</td>
                  <td className="px-4 py-2.5">{b.locationName ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`badge text-[10px] ${PHASE_BADGE[b.phase]}`}>{b.phase}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{b.count}</td>
                  <td className="px-4 py-2.5 text-muted">{dateOf(b.plantedDate)}</td>
                  <td className="px-4 py-2.5" />
                </tr>
              ))}
              {plantBatches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No plant batches yet. Start one to begin tracking your grow.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "plants" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Plant tag</th>
                <th className="px-4 py-2.5 font-medium">Strain</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Phase</th>
                <th className="px-4 py-2.5 font-medium">Planted</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {plants.map((p) => {
                const idx = PHASE_FLOW.indexOf(p.phase);
                const next = idx >= 0 && idx < PHASE_FLOW.length - 1 ? PHASE_FLOW[idx + 1] : null;
                return (
                  <tr key={p.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/cultivation/plants/${p.id}/edit`}
                        className="font-mono text-xs text-info hover:underline"
                      >
                        {p.plantTag}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{p.strainName ?? "-"}</td>
                    <td className="px-4 py-2.5">{p.locationName ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`badge text-[10px] ${PHASE_BADGE[p.phase]}`}>{p.phase}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{dateOf(p.plantedDate)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        {next && (
                          <button
                            className="btn btn-ghost px-2 py-1"
                            title={`Advance to ${next}`}
                            aria-label={`Advance plant ${p.plantTag} to ${next}`}
                            disabled={pending}
                            onClick={() => run(() => movePlantPhaseAction(p.id, next))}
                          >
                            <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {plants.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    No plants yet. Add one, or split them out of a plant batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "harvests" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Harvest</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Strain</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Plants</th>
                <th className="px-4 py-2.5 text-right font-medium">Wet</th>
                <th className="px-4 py-2.5 text-right font-medium">Dry</th>
              </tr>
            </thead>
            <tbody>
              {harvests.map((h) => (
                <tr key={h.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/cultivation/harvests/${h.id}/edit`}
                      className="font-mono text-xs text-info hover:underline"
                    >
                      {h.harvestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{h.name ?? "-"}</td>
                  <td className="px-4 py-2.5">{h.strainName ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`badge text-[10px] ${STATUS_BADGE[h.status]}`}>{h.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{h.plantCount}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {h.wetWeight != null ? h.wetWeight : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {h.dryWeight != null ? h.dryWeight : "-"}
                  </td>
                </tr>
              ))}
              {harvests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No harvests yet. Record one when a batch comes down.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
