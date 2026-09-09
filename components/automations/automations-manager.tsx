"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  Plus,
  Trash2,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
import { Select } from "@/components/ui/select";

export type RunLite = {
  id: string;
  status: string;
  summary: string | null;
  conversationId: string | null;
  createdAt: string;
  finishedAt: string | null;
};
export type WorkflowLite = {
  id: string;
  name: string;
  instruction: string;
  trigger: string;
  schedule: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  recentRuns: RunLite[];
};

type TranscriptItem = {
  kind: string;
  text?: string;
  name?: string;
  ok?: boolean | null;
  summary?: string | null;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "never";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function StatusDot({ status }: { status: string | null }) {
  if (status === "success")
    return <CheckCircle2 size={14} style={{ color: "var(--color-accent)" }} />;
  if (status === "error")
    return <XCircle size={14} style={{ color: "var(--color-danger)" }} />;
  if (status === "running")
    return <Loader2 size={14} className="animate-spin text-muted" />;
  return <Clock size={14} className="text-muted" />;
}

const EMPTY_DRAFT = {
  name: "",
  instruction: "",
  trigger: "manual" as "manual" | "schedule",
  schedule: "",
};

export function AutomationsManager({ initial }: { initial: WorkflowLite[] }) {
  const [workflows, setWorkflows] = useState<WorkflowLite[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [viewingRun, setViewingRun] = useState<RunLite | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[] | null>(null);

  async function deleteWorkflow(id: string) {
    if (!confirm("Delete this automation and its run history?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    const remaining = await refreshAll();
    setSelectedId(remaining?.[0]?.id ?? null);
  }

  const selected = workflows.find((w) => w.id === selectedId) ?? null;

  async function refreshOne(id: string) {
    const res = await fetch(`/api/workflows/${id}`);
    if (!res.ok) return;
    const { workflow, runs } = (await res.json()) as {
      workflow: Omit<WorkflowLite, "recentRuns">;
      runs: RunLite[];
    };
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...workflow, recentRuns: runs } : w)),
    );
  }

  async function refreshAll() {
    const res = await fetch("/api/workflows");
    if (!res.ok) return;
    const { workflows } = (await res.json()) as {
      workflows: (WorkflowLite & { recentRuns: RunLite[] })[];
    };
    setWorkflows(workflows);
    return workflows;
  }

  async function createWorkflow() {
    if (!draft.name.trim() || !draft.instruction.trim()) {
      setError("Name and instruction are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          instruction: draft.instruction,
          trigger: draft.trigger,
          schedule: draft.trigger === "schedule" ? draft.schedule : null,
        }),
      });
      if (!res.ok) {
        setError("Could not save the automation.");
        return;
      }
      const { workflow } = (await res.json()) as { workflow: { id: string } };
      await refreshAll();
      setSelectedId(workflow.id);
      setCreating(false);
      setDraft(EMPTY_DRAFT);
    } finally {
      setSaving(false);
    }
  }

  async function runNow(id: string) {
    setRunningId(id);
    try {
      await fetch(`/api/workflows/${id}/run`, { method: "POST" });
    } finally {
      setRunningId(null);
      await refreshOne(id);
    }
  }

  async function openRun(run: RunLite) {
    setViewingRun(run);
    setTranscript(null);
    if (!run.conversationId) return;
    const res = await fetch(`/api/conversations/${run.conversationId}`);
    if (!res.ok) return;
    const data = (await res.json()) as { items: TranscriptItem[] };
    setTranscript(data.items);
  }

  return (
    <div className="flex h-full min-h-0">
      {/* List */}
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <div className="border-b p-3">
          <button
            className="btn btn-primary w-full"
            onClick={() => {
              setCreating(true);
              setError(null);
              setDraft(EMPTY_DRAFT);
            }}
          >
            <Plus size={16} /> New automation
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {workflows.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">
              No automations yet. Create one to get started.
            </p>
          ) : (
            workflows.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className={`mb-0.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  w.id === selectedId ? "text-fg" : "text-muted hover:bg-surface2 hover:text-fg"
                }`}
                style={w.id === selectedId ? { background: "var(--color-surface2)" } : undefined}
              >
                <StatusDot status={w.lastRunStatus} />
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Detail */}
      <section className="min-w-0 flex-1 overflow-auto">
        {!selected ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="max-w-sm">
              <Workflow size={24} className="mx-auto text-muted" />
              <div className="mt-2 text-sm font-medium">Automations run tasks for you</div>
              <p className="mx-auto mt-1 text-sm text-muted">
                Save a task once - a low-stock report, a recurring cleanup - and the Copilot runs it
                unattended, approving its own actions. Create one to begin.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold">{selected.name}</h2>
                <div className="mt-1 text-xs text-muted">
                  {selected.trigger === "schedule" && selected.schedule
                    ? `Scheduled - ${selected.schedule}`
                    : "Manual trigger"}
                  {" - "}
                  last run {timeAgo(selected.lastRunAt)}
                </div>
              </div>
              <button
                className="btn btn-primary shrink-0"
                disabled={runningId === selected.id}
                onClick={() => runNow(selected.id)}
              >
                {runningId === selected.id ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Running...
                  </>
                ) : (
                  <>
                    <Play size={15} /> Run now
                  </>
                )}
              </button>
              <button
                className="btn btn-ghost shrink-0 px-2"
                title="Delete automation"
                onClick={() => deleteWorkflow(selected.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="card mt-4">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted">Instruction</div>
              <p className="whitespace-pre-wrap text-sm">{selected.instruction}</p>
            </div>

            {selected.trigger === "schedule" && (
              <p className="mt-2 text-xs text-muted">
                Schedules are saved and shown here; firing them automatically on a cron is the next step. Use Run now meanwhile.
              </p>
            )}

            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">Run history</div>
              {selected.recentRuns.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted">
                  No runs yet. Hit Run now to try it.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selected.recentRuns.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => openRun(r)}
                      className="flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors hover:border-accent"
                    >
                      <span className="mt-0.5">
                        <StatusDot status={r.status} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="font-medium capitalize">{r.status}</span>
                          <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
                        </span>
                        {r.summary && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-muted">
                            {r.summary}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-lg rounded-xl border shadow-xl" style={{ background: "var(--color-surface)" }}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">New automation</h2>
              <button className="btn btn-ghost px-2" onClick={() => setCreating(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Low-stock report"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Instruction</label>
                <textarea
                  className="input min-h-[120px] resize-y"
                  value={draft.instruction}
                  onChange={(e) => setDraft((d) => ({ ...d, instruction: e.target.value }))}
                  placeholder="Describe the full task the Copilot should perform each run, as if no one is watching. e.g. 'List every active product with on-hand below 25 units, lowest first. Read-only.'"
                />
                <p className="mt-1 text-xs text-muted">
                  Runs unattended and approves its own actions, so be specific and include any thresholds.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label">Trigger</label>
                  <Select
                    ariaLabel="Trigger"
                    value={draft.trigger}
                    onValueChange={(v) => setDraft((d) => ({ ...d, trigger: v as "manual" | "schedule" }))}
                    options={[
                      { value: "manual", label: "Manual (Run now)" },
                      { value: "schedule", label: "Scheduled" },
                    ]}
                  />
                </div>
                {draft.trigger === "schedule" && (
                  <div className="flex-1">
                    <label className="label">Schedule</label>
                    <input
                      className="input"
                      value={draft.schedule}
                      onChange={(e) => setDraft((d) => ({ ...d, schedule: e.target.value }))}
                      placeholder="daily at 8am"
                    />
                  </div>
                )}
              </div>
            </div>
            {error && <div className="px-4 pb-1 text-sm text-danger">{error}</div>}
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button className="btn btn-outline" onClick={() => setCreating(false)} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={createWorkflow}
                disabled={saving || !draft.name.trim() || !draft.instruction.trim()}
              >
                {saving ? "Saving..." : "Save automation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Run transcript drawer */}
      {viewingRun && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setViewingRun(null)}>
          <div
            className="flex h-full w-full max-w-lg flex-col border-l shadow-xl"
            style={{ background: "var(--color-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <StatusDot status={viewingRun.status} />
                Run - {timeAgo(viewingRun.createdAt)}
              </div>
              <button className="btn btn-ghost px-2" onClick={() => setViewingRun(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {transcript === null ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={15} className="animate-spin" /> Loading what happened...
                </div>
              ) : transcript.length === 0 ? (
                <p className="text-sm text-muted">No detail recorded for this run.</p>
              ) : (
                <div className="space-y-2.5">
                  {transcript.map((it, i) =>
                    it.kind === "tool" ? (
                      <div key={i} className="flex items-start gap-2 rounded-lg border p-2.5 text-sm">
                        {it.ok === false ? (
                          <XCircle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--color-danger)" }} />
                        ) : (
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                        )}
                        <span className="min-w-0">
                          <span className="font-mono text-xs text-muted">{it.name}</span>
                          {it.summary && <span className="mt-0.5 block">{it.summary}</span>}
                        </span>
                      </div>
                    ) : it.kind === "assistant" && it.text ? (
                      <div key={i} className="whitespace-pre-wrap rounded-lg px-1 text-sm">
                        {it.text}
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
