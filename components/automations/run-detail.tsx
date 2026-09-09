"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Streamdown } from "streamdown";
import {
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  Loader2,
  MinusCircle,
  PenLine,
  ScrollText,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NodeRun, NodeType } from "@/lib/harness/graph/types";

type ReportRef = { id: string; title: string; format: string };

type TranscriptItem = {
  kind: string;
  text?: string;
  name?: string;
  ok?: boolean | null;
  summary?: string | null;
};

const NODE_ICON: Partial<Record<NodeType, LucideIcon>> = {
  agent: Bot,
  action: Boxes,
  if: GitBranch,
  transform: PenLine,
};

function StepStatus({ status }: { status: NodeRun["status"] }) {
  if (status === "error") return <XCircle size={14} className="shrink-0" style={{ color: "var(--color-danger)" }} />;
  if (status === "skipped") return <MinusCircle size={14} className="shrink-0 text-muted" />;
  return <CheckCircle2 size={14} className="shrink-0" style={{ color: "var(--color-accent)" }} />;
}

/** One run's detail: any artifacts it produced, the rendered report, then a
 *  step-by-step node breakdown. */
export function RunDetail({
  run,
}: {
  run: { id: string; summary: string | null; nodeRuns?: NodeRun[] | null };
}) {
  const [reports, setReports] = useState<ReportRef[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/reports?runId=${run.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && setReports(d.reports as ReportRef[]))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [run.id]);

  return (
    <div className="space-y-3">
      {reports && reports.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Reports produced
          </div>
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports?id=${r.id}`}
              className="flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:border-accent"
            >
              <ScrollText size={14} className="shrink-0" style={{ color: "var(--color-accent)" }} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
              <span className="badge text-[10px] uppercase">{r.format}</span>
            </Link>
          ))}
        </div>
      )}

      {run.summary && (
        <div className="copilot-md rounded-lg border p-3 text-sm">
          <Streamdown shikiTheme={["github-light", "github-dark"]}>{run.summary}</Streamdown>
        </div>
      )}

      {run.nodeRuns && run.nodeRuns.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Steps ({run.nodeRuns.length})
          </div>
          {run.nodeRuns.map((nr, i) => (
            <StepRow key={`${nr.nodeId}-${i}`} nr={nr} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ nr }: { nr: NodeRun }) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[] | null>(null);
  const Icon = NODE_ICON[nr.type] ?? Boxes;
  // Only agent steps have their own conversation transcript worth drilling into.
  const canExpand = nr.type === "agent" && !!nr.conversationId;

  async function toggle() {
    if (!canExpand) return;
    const next = !open;
    setOpen(next);
    if (next && transcript === null && nr.conversationId) {
      const res = await fetch(`/api/conversations/${nr.conversationId}`);
      if (res.ok) setTranscript(((await res.json()) as { items: TranscriptItem[] }).items);
    }
  }

  return (
    <div className="rounded-lg border">
      <button
        onClick={toggle}
        disabled={!canExpand}
        className={`flex w-full items-center gap-2 p-2.5 text-left ${canExpand ? "hover:bg-surface2" : "cursor-default"}`}
      >
        <StepStatus status={nr.status} />
        <Icon size={13} className="shrink-0 text-muted" />
        <span className="shrink-0 text-sm font-medium">{nr.name}</span>
        {nr.summary && (
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{nr.summary}</span>
        )}
        {canExpand && (
          <ChevronRight
            size={14}
            className="ml-auto shrink-0 text-muted transition-transform"
            style={{ transform: open ? "rotate(90deg)" : undefined }}
          />
        )}
      </button>

      {open && (
        <div className="space-y-2 border-t p-2.5">
          {transcript === null ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading what the agent did…
            </div>
          ) : transcript.length === 0 ? (
            <p className="text-sm text-muted">No detail recorded.</p>
          ) : (
            transcript.map((it, i) =>
              it.kind === "tool" ? (
                <div key={i} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
                  {it.ok === false ? (
                    <XCircle size={13} className="mt-0.5 shrink-0" style={{ color: "var(--color-danger)" }} />
                  ) : (
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
                  )}
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-muted">{it.name}</span>
                    {it.summary && <span className="mt-0.5 block">{it.summary}</span>}
                  </span>
                </div>
              ) : it.kind === "assistant" && it.text ? (
                <div key={i} className="copilot-md text-sm">
                  <Streamdown shikiTheme={["github-light", "github-dark"]}>{it.text}</Streamdown>
                </div>
              ) : null,
            )
          )}
        </div>
      )}
    </div>
  );
}
