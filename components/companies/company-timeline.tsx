"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Package, Receipt, StickyNote, Trash2 } from "lucide-react";
import {
  addCompanyNoteAction,
  deleteCompanyNoteAction,
} from "@/app/(app)/companies/actions";

export type TimelineEntry =
  | { kind: "note"; id: string; at: string; body: string; author: string | null }
  | {
      kind: "order";
      id: string;
      at: string;
      label: string;
      status: string;
      total: string;
      href: string;
    }
  | {
      kind: "invoice";
      id: string;
      at: string;
      label: string;
      status: string;
      total: string;
      balance: string;
      href: string;
    };

function when(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EntryIcon({ kind }: { kind: TimelineEntry["kind"] }) {
  const cls = "mt-0.5 shrink-0 text-muted";
  if (kind === "note") return <StickyNote size={16} className={cls} />;
  if (kind === "order") return <Package size={16} className={cls} />;
  return <Receipt size={16} className={cls} />;
}

export function CompanyTimeline({
  companyId,
  entries,
}: {
  companyId: string;
  entries: TimelineEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addNote() {
    const text = body.trim();
    if (!text) return;
    setError(null);
    startTransition(async () => {
      const res = await addCompanyNoteAction(companyId, text);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(res.error ?? "Could not add note.");
      }
    });
  }

  function removeNote(noteId: string) {
    if (!confirm("Delete this note?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteCompanyNoteAction(companyId, noteId);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not delete note.");
    });
  }

  return (
    <section className="card">
      <div className="mb-3 flex items-center gap-2">
        <FileText size={15} className="text-muted" />
        <h2 className="text-sm font-semibold">Activity</h2>
      </div>

      <div className="mb-4">
        <textarea
          className="input min-h-20 resize-y"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a sales note — a call, meeting, or follow-up…"
          disabled={pending}
        />
        <div className="mt-2 flex items-center justify-between">
          {error ? (
            <span className="text-xs text-danger">{error}</span>
          ) : (
            <span className="text-xs text-muted">
              Notes appear on this timeline alongside orders and invoices.
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={addNote}
            disabled={pending || !body.trim()}
          >
            {pending ? "Saving…" : "Add note"}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">No activity yet.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="flex gap-3 border-t pt-3 first:border-t-0 first:pt-0">
              <EntryIcon kind={e.kind} />
              <div className="min-w-0 flex-1">
                {e.kind === "note" ? (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm">{e.body}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span>{e.author ?? "Someone"}</span>
                      <span aria-hidden>·</span>
                      <span>{when(e.at)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={e.href} className="font-medium hover:underline">
                        {e.label}
                      </Link>
                      <span className="badge">{e.status}</span>
                      <span className="text-muted">${e.total}</span>
                      {e.kind === "invoice" && Number(e.balance) > 0 && (
                        <span className="text-danger">${e.balance} due</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted">{when(e.at)}</div>
                  </>
                )}
              </div>
              {e.kind === "note" && (
                <button
                  className="btn btn-ghost px-2 py-1"
                  title="Delete note"
                  aria-label="Delete note"
                  disabled={pending}
                  onClick={() => removeNote(e.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
