"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { emptyGraph } from "@/lib/harness/graph/validate";
import type { NodeRun, WorkflowGraph } from "@/lib/harness/graph/types";
import { GraphEditor } from "./graph-editor";
import { RunDetail } from "./run-detail";

export type RunLite = {
  id: string;
  status: string;
  summary: string | null;
  conversationId: string | null;
  trigger?: string | null;
  nodeRuns?: NodeRun[] | null;
  createdAt: string;
  finishedAt: string | null;
};
export type WorkflowLite = {
  id: string;
  name: string;
  trigger: string;
  schedule: string | null;
  graph: WorkflowGraph | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  recentRuns: RunLite[];
};

/** Launch the Copilot with a prompt so it builds the workflow conversationally. */
function askCopilot(text: string) {
  const t = text.trim();
  if (!t) return;
  window.dispatchEvent(new CustomEvent("distru:copilot:open"));
  window.dispatchEvent(new CustomEvent("distru:copilot:prompt", { detail: { text: t } }));
}

/** Example asks that teach: you can just describe an automation to the Copilot. */
const EXAMPLE_PROMPTS = [
  "Create an automation that lists products under 25 units every weekday at 8am",
  "Create an automation that summarizes last week's sales every Monday morning",
  "Create an automation that flags orders still pending every evening",
];

/** A clean one-line preview of a run summary (the summary itself is markdown). */
function snippet(md: string): string {
  return (
    md
      .replace(/[*_`#>]/g, "")
      .replace(/\|/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? ""
  );
}

function StatusDot({ status }: { status: string | null }) {
  if (status === "success")
    return <CheckCircle2 size={14} style={{ color: "var(--color-accent)" }} />;
  if (status === "error") return <XCircle size={14} style={{ color: "var(--color-danger)" }} />;
  if (status === "running") return <Loader2 size={14} className="animate-spin text-muted" />;
  return <Clock size={14} className="text-muted" />;
}

export function AutomationsManager({ initial }: { initial: WorkflowLite[] }) {
  const [workflows, setWorkflows] = useState<WorkflowLite[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const selected = workflows.find((w) => w.id === selectedId) ?? null;

  const refreshAll = useCallback(async () => {
    const res = await fetch("/api/workflows");
    if (!res.ok) return;
    const { workflows } = (await res.json()) as { workflows: WorkflowLite[] };
    setWorkflows(workflows);
    return workflows;
  }, []);

  // When the Copilot finishes a turn (e.g. it just built a workflow from a
  // clicked example prompt), re-fetch the list so the new automation appears -
  // selecting it if nothing was selected yet.
  useEffect(() => {
    const onDone = async () => {
      const list = await refreshAll();
      setSelectedId((cur) => (!cur && list && list.length ? list[0].id : cur));
    };
    window.addEventListener("distru:copilot:done", onDone);
    return () => window.removeEventListener("distru:copilot:done", onDone);
  }, [refreshAll]);

  // Deep link from a notification: /automations?wf=<id>&run=<id> selects the
  // workflow, opens History, and expands that run.
  const params = useSearchParams();
  useEffect(() => {
    const wf = params.get("wf");
    const run = params.get("run");
    if (!wf && !run) return;
    if (wf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(wf);
      void refreshOne(wf);
    }
    if (run) {
      setHistoryOpen(true);
      setOpenRunId(run);
    }
  }, [params]);

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
    return runs;
  }

  async function createWorkflow() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), graph: emptyGraph() }),
      });
      if (!res.ok) return;
      const { workflow } = (await res.json()) as { workflow: { id: string } };
      await refreshAll();
      setSelectedId(workflow.id);
      setCreating(false);
      setNewName("");
    } finally {
      setSaving(false);
    }
  }

  async function renameWorkflow(id: string, name: string) {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
    await fetch(`/api/workflows/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Delete this automation and its run history?")) return;
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    const remaining = await refreshAll();
    setSelectedId(remaining?.[0]?.id ?? null);
  }

  function openRun(run: RunLite) {
    setOpenRunId((cur) => (cur === run.id ? null : run.id));
  }

  return (
    <div className="flex h-full min-h-0">
      {/* List */}
      <aside className="flex w-64 shrink-0 flex-col border-r">
        <div className="border-b p-3">
          <button className="btn btn-primary w-full" onClick={() => setCreating(true)}>
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
                {w.trigger === "schedule" && <Clock size={12} className="shrink-0 text-muted" />}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Editor */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="grid h-full place-items-center p-8 text-center">
            <div className="w-full max-w-md">
              <Workflow size={24} className="mx-auto text-muted" />
              <div className="mt-2 text-sm font-medium">Build automations as a node graph</div>
              <p className="mx-auto mt-1 text-sm text-muted">
                Chain triggers, AI agents with their own tools, conditions, and deterministic
                actions - with AI as a first-class node.
              </p>

              <div className="mt-6 rounded-xl border p-4 text-left">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles size={14} style={{ color: "var(--color-accent)" }} />
                  Just describe it to the Copilot
                </div>
                <p className="mt-1 text-xs text-muted">
                  Click an example and the Copilot builds the workflow for you - including scheduled ones.
                </p>
                <div className="mt-3 flex flex-col gap-1.5">
                  {EXAMPLE_PROMPTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => askCopilot(s)}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs text-muted transition-colors hover:border-accent hover:bg-surface2 hover:text-fg"
                    >
                      <Sparkles size={13} className="shrink-0" style={{ color: "var(--color-accent)" }} />
                      <span className="min-w-0">&ldquo;{s}&rdquo;</span>
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn btn-outline mt-4" onClick={() => setCreating(true)}>
                <Plus size={15} /> Or build one by hand
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b px-4 py-2.5">
              <input
                className="input max-w-xs border-transparent bg-transparent px-1 text-sm font-semibold hover:border-border focus:border-border"
                value={selected.name}
                onChange={(e) => renameWorkflow(selected.id, e.target.value)}
              />
              {selected.trigger === "schedule" && selected.schedule && (
                <span className="badge text-[10px]">
                  <Clock size={11} /> {selected.schedule}
                </span>
              )}
              <div className="ml-auto flex items-center gap-1">
                <button
                  className="btn btn-ghost text-xs"
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  <History size={14} /> History
                </button>
                <button
                  className="btn btn-ghost px-2"
                  title="Delete automation"
                  onClick={() => deleteWorkflow(selected.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </header>
            <div className="min-h-0 flex-1">
              <GraphEditor
                key={selected.id}
                workflowId={selected.id}
                initialGraph={selected.graph ?? emptyGraph()}
                tools={[]}
                onRunComplete={async () => {
                  const runs = await refreshOne(selected.id);
                  setHistoryOpen(true);
                  if (runs?.[0]) setOpenRunId(runs[0].id); // land on the run you just triggered
                }}
              />
            </div>
          </>
        )}
      </section>

      {/* Run history drawer */}
      {historyOpen && selected && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setHistoryOpen(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col border-l shadow-xl"
            style={{ background: "var(--color-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <History size={15} /> Run history
              </div>
              <button className="btn btn-ghost px-2" onClick={() => setHistoryOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {selected.recentRuns.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted">
                  No runs yet. Hit Run on the canvas to try it.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selected.recentRuns.map((r) => (
                    <div key={r.id} className="rounded-lg border">
                      <button
                        onClick={() => openRun(r)}
                        className="flex w-full items-start gap-2.5 p-3 text-left"
                      >
                        <span className="mt-0.5">
                          <StatusDot status={r.status} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm">
                            <span className="font-medium capitalize">{r.status}</span>
                            {r.trigger && <span className="badge text-[10px]">{r.trigger}</span>}
                            <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
                          </span>
                          {r.summary && (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{snippet(r.summary)}</span>
                          )}
                        </span>
                      </button>
                      {openRunId === r.id && (
                        <div className="border-t p-3">
                          <RunDetail run={r} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="w-full max-w-sm rounded-xl border shadow-xl" style={{ background: "var(--color-surface)" }}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">New automation</h2>
              <button className="btn btn-ghost px-2" onClick={() => setCreating(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <label className="label">Name</label>
              <input
                className="input"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createWorkflow()}
                placeholder="Low-stock reorder"
              />
              <p className="mt-1 text-xs text-muted">
                Starts with a manual trigger. Build the graph on the canvas, or use Generate.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <button className="btn btn-outline" onClick={() => setCreating(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createWorkflow} disabled={saving || !newName.trim()}>
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
