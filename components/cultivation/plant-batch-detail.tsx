"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import {
  advancePlantBatchPhaseAction,
  logPlantEventAction,
  type PlantEventForm,
} from "@/app/(app)/cultivation/actions";
import { EventTimeline, type EventItem } from "./event-timeline";

type PlantPhase = "IMMATURE" | "VEGETATIVE" | "FLOWERING" | "HARVESTED" | "DESTROYED";

const PHASE_FLOW: PlantPhase[] = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED"];
const PHASE_BADGE: Record<PlantPhase, string> = {
  IMMATURE: "text-muted",
  VEGETATIVE: "text-info",
  FLOWERING: "text-accent",
  HARVESTED: "text-warn",
  DESTROYED: "text-danger",
};
const EVENT_TYPES: PlantEventForm["type"][] = ["NOTE", "FEED", "MOVE"];

export type BatchDetail = {
  id: string;
  batchNumber: string;
  strainName: string | null;
  locationName: string | null;
  count: number;
  phase: PlantPhase;
  sourceType: string | null;
  plantedDate: string | null;
};

export type BatchPlant = {
  id: string;
  plantTag: string;
  phase: PlantPhase;
};

const dateOf = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "-");

export function PlantBatchDetail({
  batch,
  plants,
  events,
}: {
  batch: BatchDetail;
  plants: BatchPlant[];
  events: EventItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteType, setNoteType] = useState<PlantEventForm["type"]>("NOTE");
  const [note, setNote] = useState("");

  const idx = PHASE_FLOW.indexOf(batch.phase);
  const next = idx >= 0 && idx < PHASE_FLOW.length - 1 ? PHASE_FLOW[idx + 1] : null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        after?.();
        router.refresh();
      } else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/cultivation" className="btn btn-ghost">
          <ArrowLeft size={16} /> Cultivation
        </Link>
        <div className="min-w-0">
          <h1 className="font-mono text-lg font-semibold">{batch.batchNumber}</h1>
          <p className="text-sm text-muted">
            {batch.strainName ?? "Unknown strain"} &middot; {batch.count} plant(s)
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {next && (
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() => run(() => advancePlantBatchPhaseAction(batch.id, next))}
            >
              Advance to {next} <ChevronRight size={16} />
            </button>
          )}
          <Link href={`/cultivation/plant-batches/${batch.id}/edit`} className="btn btn-outline">
            <Pencil size={16} /> Edit
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Phase", batch.phase],
          ["Count", String(batch.count)],
          ["Source", batch.sourceType ?? "-"],
          ["Planted", dateOf(batch.plantedDate)],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-sm font-semibold">
              {label === "Phase" ? (
                <span className={`badge text-[10px] ${PHASE_BADGE[batch.phase]}`}>{value}</span>
              ) : (
                value
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Plants ({plants.length})</h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
                  <th className="px-4 py-2.5 font-medium">Tag</th>
                  <th className="px-4 py-2.5 font-medium">Phase</th>
                </tr>
              </thead>
              <tbody>
                {plants.map((p) => (
                  <tr key={p.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/cultivation/plants/${p.id}`}
                        className="font-mono text-xs text-info hover:underline"
                      >
                        {p.plantTag}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`badge text-[10px] ${PHASE_BADGE[p.phase]}`}>{p.phase}</span>
                    </td>
                  </tr>
                ))}
                {plants.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted">
                      No individual plants promoted from this batch yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Timeline</h2>
          <div className="card mb-3">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Event</label>
                <select
                  className="input"
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as PlantEventForm["type"])}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted">Note</label>
                <input
                  className="input"
                  value={note}
                  placeholder="e.g. Top-dressed with compost"
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                disabled={pending || !note.trim()}
                onClick={() =>
                  run(
                    () =>
                      logPlantEventAction({
                        plantBatchId: batch.id,
                        type: noteType,
                        note: note.trim(),
                      }),
                    () => setNote(""),
                  )
                }
              >
                <Plus size={16} /> Log
              </button>
            </div>
          </div>
          <EventTimeline events={events} />
        </section>
      </div>
    </div>
  );
}
