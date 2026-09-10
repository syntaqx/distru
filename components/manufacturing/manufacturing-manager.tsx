"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Factory, Lock, Plus, Tag, User } from "lucide-react";

export type AssemblyRow = {
  id: string;
  assemblyNumber: string;
  outputProduct: string | null;
  status: string;
  inputCount: number;
  createdAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimatedWorkMinutes: number | null;
  assignedTo: string | null;
  isReserved: boolean;
  hasShortfall: boolean;
};
export type CostRow = {
  id: string;
  assemblyNumber: string | null;
  costType: string | null;
  description: string | null;
  amount: number;
};
export type CostTypeRow = { id: string; name: string; count: number };

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const dayHeading = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const timeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const STATUS_BADGE: Record<string, string> = {
  PENDING: "text-muted",
  IN_PROGRESS: "text-info",
  COMPLETED: "text-accent",
  CANCELED: "text-danger",
};

export function ManufacturingManager({
  assemblies,
  costs,
  costTypes,
}: {
  assemblies: AssemblyRow[];
  costs: CostRow[];
  costTypes: CostTypeRow[];
}) {
  const [tab, setTab] = useState<"assemblies" | "schedule" | "costs">("assemblies");

  const inProgress = assemblies.filter((a) => a.status === "IN_PROGRESS").length;

  // Upcoming planned/in-progress runs with a scheduled start, soonest first,
  // grouped by calendar day for the schedule view.
  const scheduled = assemblies
    .filter((a) => a.scheduledStart && (a.status === "PENDING" || a.status === "IN_PROGRESS"))
    .sort(
      (a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime(),
    );
  const scheduledDays: { key: string; iso: string; runs: AssemblyRow[] }[] = [];
  for (const a of scheduled) {
    const key = dayKey(a.scheduledStart!);
    const bucket = scheduledDays.find((d) => d.key === key);
    if (bucket) bucket.runs.push(a);
    else scheduledDays.push({ key, iso: a.scheduledStart!, runs: [a] });
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Assemblies", assemblies.length],
          ["In progress", inProgress],
          ["Scheduled", scheduled.length],
          ["Cost types", costTypes.length],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">
              {label}
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
          {(["assemblies", "schedule", "costs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
                tab === t ? "text-fg" : "text-muted hover:text-fg"
              }`}
              style={
                tab === t ? { background: "var(--color-surface2)" } : undefined
              }
            >
              {t}
            </button>
          ))}
        </div>
        <Link href="/manufacturing/new" className="btn btn-primary ml-auto">
          <Plus size={16} /> New assembly
        </Link>
      </div>

      {tab === "assemblies" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Assembly</th>
                <th className="px-4 py-2.5 font-medium">Output product</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Inputs</th>
                <th className="px-4 py-2.5 text-right font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {assemblies.map((a) => (
                <tr
                  key={a.id}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/manufacturing/${a.id}`}
                      className="font-mono text-xs text-info hover:underline"
                    >
                      {a.assemblyNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{a.outputProduct ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`badge text-[10px] ${STATUS_BADGE[a.status] ?? ""}`}
                      >
                        {a.status}
                      </span>
                      {a.isReserved && (
                        <Lock size={12} className="text-info" aria-label="Inputs reserved" />
                      )}
                      {a.hasShortfall && (
                        <AlertTriangle
                          size={12}
                          className="text-danger"
                          aria-label="Inputs exceed available stock"
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {a.inputCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {shortDate(a.createdAt)}
                  </td>
                </tr>
              ))}
              {assemblies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No assemblies yet. Create one to turn input inventory into a
                    finished product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "schedule" && (
        <div className="space-y-5">
          {scheduledDays.length === 0 ? (
            <div className="rounded-xl border px-4 py-10 text-center text-sm text-muted">
              No scheduled runs. Give an assembly a planned start date to see it
              on the production schedule.
            </div>
          ) : (
            scheduledDays.map((day) => (
              <div key={day.key}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <CalendarClock size={15} className="text-muted" />
                  {dayHeading(day.iso)}
                  <span className="text-xs font-normal text-muted">
                    ({day.runs.length})
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {day.runs.map((a) => (
                    <Link
                      key={a.id}
                      href={`/manufacturing/${a.id}`}
                      className="card block transition-colors hover:border-info/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-info">
                          {a.assemblyNumber}
                        </span>
                        <span
                          className={`badge text-[10px] ${STATUS_BADGE[a.status] ?? ""}`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <div className="mt-1.5 truncate text-sm font-medium">
                        {a.outputProduct ?? "-"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>{timeOfDay(a.scheduledStart!)}</span>
                        {a.estimatedWorkMinutes != null && (
                          <span>~{a.estimatedWorkMinutes} min</span>
                        )}
                        {a.assignedTo && (
                          <span className="inline-flex items-center gap-1">
                            <User size={11} /> {a.assignedTo}
                          </span>
                        )}
                        {a.isReserved && (
                          <span className="inline-flex items-center gap-1 text-info">
                            <Lock size={11} /> reserved
                          </span>
                        )}
                      </div>
                      {a.hasShortfall && (
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-danger">
                          <AlertTriangle size={12} /> Inputs exceed available stock
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "costs" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="overflow-x-auto rounded-xl border lg:col-span-2">
            <table className="w-full min-w-120 text-sm">
              <thead>
                <tr
                  className="text-left text-muted"
                  style={{ background: "var(--color-surface)" }}
                >
                  <th className="px-4 py-2.5 font-medium">Cost type</th>
                  <th className="px-4 py-2.5 font-medium">Assembly</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <td className="px-4 py-2.5">{c.costType ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      {c.assemblyNumber ? (
                        <span className="font-mono text-xs text-muted">
                          {c.assemblyNumber}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2.5">{c.description ?? "-"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {money(c.amount)}
                    </td>
                  </tr>
                ))}
                {costs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted">
                      No costs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <Tag size={14} /> Cost types
            </div>
            {costTypes.length === 0 ? (
              <p className="text-sm text-muted">No cost types defined.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {costTypes.map((ct) => (
                  <li key={ct.id} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Factory size={13} className="text-muted" />
                      {ct.name}
                    </span>
                    <span className="tabular-nums text-muted">{ct.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
