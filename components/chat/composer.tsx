"use client";

import { useRef, useState } from "react";
import { FileText, Loader, Paperclip, Send, Square, X } from "lucide-react";

export function Composer({
  disabled,
  streaming,
  onStop,
  onSend,
  onUpload,
}: {
  disabled: boolean;
  streaming: boolean;
  onStop: () => void;
  onSend: (text: string, importJobId?: string) => void;
  onUpload: (file: File) => Promise<{ jobId: string; rowCount: number } | null>;
}) {
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<{ jobId: string; rowCount: number; filename: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function send() {
    if (disabled || streaming) return;
    if (!text.trim() && !attached) return;
    const msg = text.trim() || (attached ? `I uploaded ${attached.filename}. What can you do with it?` : "");
    onSend(msg, attached?.jobId);
    setText("");
    setAttached(null);
  }

  async function onFile(file: File) {
    setUploading(true);
    const r = await onUpload(file);
    setUploading(false);
    if (r) setAttached({ jobId: r.jobId, rowCount: r.rowCount, filename: file.name });
  }

  return (
    <div className="border-t px-6 py-3">
      <div className="mx-auto max-w-3xl">
        {attached && (
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="badge" style={{ color: "var(--color-accent)" }}>
              <FileText size={13} /> {attached.filename}
            </span>
            <span className="text-xs text-muted">{attached.rowCount} rows ready to import</span>
            <button
              className="inline-flex items-center gap-0.5 text-xs text-muted hover:underline"
              onClick={() => setAttached(null)}
            >
              <X size={12} /> remove
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border p-2" style={{ background: "var(--color-surface)" }}>
          <button
            className="btn btn-ghost px-2"
            title="Upload CSV / XLSX"
            disabled={disabled || uploading || streaming}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader size={18} className="animate-spin" /> : <Paperclip size={18} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <textarea
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none"
            rows={1}
            placeholder="Message Distru Copilot…"
            value={text}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          {streaming ? (
            <button className="btn btn-outline" onClick={onStop} aria-label="Stop" title="Stop">
              <Square size={15} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={disabled || (!text.trim() && !attached)}
              onClick={send}
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-[var(--color-muted)]">
          Mutations require your approval. Distru Copilot can make mistakes - review changes.
        </p>
      </div>
    </div>
  );
}
