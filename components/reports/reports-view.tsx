"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Streamdown } from "streamdown";
import { ArrowLeft, Cloud, Download, Loader2, Mail, ScrollText } from "lucide-react";
import { timeAgo } from "@/lib/format";

export type Delivery = { destination: string; target: string; externalId: string | null; at: string };
export type ReportLite = {
  id: string;
  title: string;
  kind: string;
  format: string;
  createdBy: string | null;
  deliveries: Delivery[];
  createdAt: string;
};
type ReportFull = ReportLite & { content: string; workflowRunId: string | null };

function DeliveryBadge({ d }: { d: Delivery }) {
  const email = d.destination === "email";
  return (
    <span className="badge text-[10px]" title={`${d.target} · ${timeAgo(d.at)}`}>
      {email ? <Mail size={11} /> : <Cloud size={11} />}
      {email ? d.target : "Drive"}
    </span>
  );
}

export function ReportsView({ initial }: { initial: ReportLite[] }) {
  const params = useSearchParams();
  const urlId = params.get("id");
  const [reports] = useState<ReportLite[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(urlId ?? initial[0]?.id ?? null);
  const [report, setReport] = useState<ReportFull | null>(null);
  const [loading, setLoading] = useState(false);
  // Mobile is a master-detail: the list, then the viewer with a back button.
  // Desktop shows both side-by-side regardless.
  const [mobileDetail, setMobileDetail] = useState(!!urlId);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setReport(null);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (res.ok) setReport((await res.json()).report as ReportFull);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (urlId) setSelectedId(urlId);
  }, [urlId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedId) void load(selectedId);
  }, [selectedId, load]);

  function download() {
    if (!report) return;
    const ext = report.format === "csv" ? "csv" : report.format === "json" ? "json" : report.format === "markdown" ? "md" : "txt";
    const mime = report.format === "csv" ? "text/csv" : report.format === "json" ? "application/json" : "text/plain";
    const blob = new Blob([report.content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^\w.-]+/g, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const meta = reports.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* List — full-width on mobile, a fixed rail on desktop. Hidden on mobile
          once you're viewing a report. */}
      <aside
        className={`${mobileDetail ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r md:w-72`}
      >
        <div className="flex-1 overflow-auto p-2">
          {reports.length === 0 ? (
            <div className="p-6 text-center">
              <ScrollText size={22} className="mx-auto text-muted" />
              <p className="mt-2 text-sm text-muted">
                No reports yet. Ask the Copilot for one, or add a{" "}
                <span className="font-medium">save_report</span> step to an automation.
              </p>
            </div>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedId(r.id);
                  setMobileDetail(true);
                }}
                className={`mb-0.5 flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors ${
                  r.id === selectedId ? "text-fg" : "text-muted hover:bg-surface2 hover:text-fg"
                }`}
                style={r.id === selectedId ? { background: "var(--color-surface2)" } : undefined}
              >
                <span className="flex items-center gap-2 text-sm">
                  <ScrollText size={14} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                </span>
                <span className="flex items-center gap-1.5 pl-6 text-xs text-muted">
                  {timeAgo(r.createdAt)}
                  {r.deliveries.length > 0 && <span>· delivered</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Viewer — hidden on mobile until a report is opened. */}
      <section
        className={`${mobileDetail ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-auto`}
      >
        {!meta ? (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-muted">
            Select a report to view it.
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
            <button
              className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-fg md:hidden"
              onClick={() => setMobileDetail(false)}
            >
              <ArrowLeft size={15} /> All reports
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold wrap-break-word">{meta.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="badge text-[10px] uppercase">{meta.format}</span>
                  <span>Created {timeAgo(meta.createdAt)}</span>
                  {meta.createdBy?.startsWith("workflow:") && <span>· by an automation</span>}
                  {meta.deliveries.map((d, i) => (
                    <DeliveryBadge key={i} d={d} />
                  ))}
                </div>
              </div>
              <button className="btn btn-outline shrink-0" onClick={download} disabled={!report}>
                <Download size={15} /> Download
              </button>
            </div>

            <div className="mt-5">
              {loading || !report ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 size={15} className="animate-spin" /> Loading report…
                </div>
              ) : report.format === "markdown" ? (
                <div className="copilot-md text-sm leading-relaxed">
                  <Streamdown shikiTheme={["github-light", "github-dark"]} controls={{ table: { fullscreen: false } }}>{report.content}</Streamdown>
                </div>
              ) : (
                <pre className="overflow-x-auto rounded-xl border p-4 text-xs" style={{ background: "var(--color-surface)" }}>
                  {report.content}
                </pre>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
