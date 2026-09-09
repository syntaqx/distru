"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  GripVertical,
  History,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { readNdjson } from "@/lib/ndjson-client";
import type { HarnessEvent, Interrupt, ToolDecision } from "@/lib/harness/types";
import { BlockView, ThinkingDots, type ChatBlock } from "./blocks";
import { GateCard } from "./gate-cards";
import { Composer } from "./composer";

type ConversationLite = { id: string; title: string; updatedAt?: string };

function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const SUGGESTIONS = [
  "What are my top categories and how much stock do I have?",
  "Add a product: Gelato 3.5g, SKU FL-GEL-35, Flower, vendor Sungrown Farms, unit gram, $34",
  "How do I create a product category?",
  "Upload a CSV to import products, prices, or customers",
];

function pageLabel(p: string): string | null {
  if (p.startsWith("/inventory")) return "Inventory";
  if (p.startsWith("/companies")) return "Companies";
  if (p.startsWith("/dashboard")) return "Dashboard";
  if (p.startsWith("/integrations")) return "Integrations";
  return null;
}

export function ChatView({
  compact = false,
  onClose,
  onHeaderPointerDown,
  onToggleExpand,
  expanded,
}: {
  compact?: boolean;
  onClose?: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
  onToggleExpand?: () => void;
  expanded?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationLite[]>([]);
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [pending, setPending] = useState<Interrupt[]>([]);
  const [decisions, setDecisions] = useState<Record<string, ToolDecision>>({});
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function openConversation(id: string) {
    setConversationId(id);
    setPending([]);
    setDecisions({});
    setError(null);
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      items: {
        kind: string;
        text?: string;
        name?: string;
        status?: string;
        ok?: boolean | null;
        summary?: string | null;
        data?: unknown;
        toolUseId?: string;
      }[];
      pending: Interrupt[];
    };
    setBlocks(
      data.items.map((it) =>
        it.kind === "tool"
          ? {
              type: "tool",
              toolUseId: it.toolUseId ?? "",
              name: it.name ?? "tool",
              status: it.status ?? "done",
              ok: it.ok ?? null,
              summary: it.summary ?? null,
              data: it.data,
            }
          : { type: it.kind as "user" | "assistant", text: it.text ?? "" },
      ),
    );
    setPending(data.pending);
  }

  async function refreshConversations() {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const { conversations } = (await res.json()) as { conversations: ConversationLite[] };
      setConversations(conversations);
    }
  }

  function applyEvent(e: HarnessEvent) {
    switch (e.type) {
      case "token":
        setBlocks((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "assistant")
            return [...prev.slice(0, -1), { ...last, text: last.text + e.text }];
          return [...prev, { type: "assistant", text: e.text }];
        });
        break;
      case "thinking":
        setBlocks((prev) => {
          const last = prev[prev.length - 1];
          if (last?.type === "thinking")
            return [...prev.slice(0, -1), { ...last, text: last.text + e.text }];
          return [...prev, { type: "thinking", text: e.text }];
        });
        break;
      case "tool_start":
        setBlocks((prev) => [
          ...prev,
          { type: "tool", toolUseId: e.toolUseId, name: e.name, status: "running" },
        ]);
        break;
      case "tool_result":
        setBlocks((prev) =>
          prev.map((b) =>
            b.type === "tool" && b.toolUseId === e.toolUseId
              ? { ...b, status: e.ok ? "done" : "error", ok: e.ok, summary: e.summary }
              : b,
          ),
        );
        break;
      case "interrupt":
        setPending(e.interrupts);
        setBlocks((prev) =>
          prev.map((b) =>
            b.type === "tool" && e.interrupts.some((i) => i.toolUseId === b.toolUseId)
              ? { ...b, status: "pending" }
              : b,
          ),
        );
        break;
      case "error":
        setError(e.message);
        setStreaming(false);
        break;
      case "done":
        setStreaming(false);
        void refreshConversations();
        router.refresh(); // keep the page behind the dock in sync with agent changes
        break;
    }
  }

  // Sets the "thinking" state immediately (before the first byte arrives) and
  // streams the NDJSON response; abortable via stop().
  async function runRequest(url: string, body: unknown) {
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      await readNdjson(res, applyEvent);
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const res = await fetch("/api/conversations", { method: "POST" });
    const { conversation } = (await res.json()) as { conversation: ConversationLite };
    setConversationId(conversation.id);
    setConversations((c) => [conversation, ...c]);
    return conversation.id;
  }

  async function sendMessage(text: string, importJobId?: string) {
    setError(null);
    const id = await ensureConversation();
    setBlocks((prev) => [...prev, { type: "user", text }]);
    await runRequest(`/api/conversations/${id}/messages`, {
      text,
      importJobId,
      pageContext: pageLabel(pathname),
    });
  }

  async function uploadFile(file: File): Promise<{ jobId: string; rowCount: number } | null> {
    const id = await ensureConversation();
    const form = new FormData();
    form.append("file", file);
    form.append("targetKey", "products");
    form.append("conversationId", id);
    const res = await fetch("/api/imports", { method: "POST", body: form });
    if (!res.ok) {
      setError("Upload failed: " + (await res.text()));
      return null;
    }
    const data = (await res.json()) as { job: { id: string }; file: { rowCount: number } };
    return { jobId: data.job.id, rowCount: data.file.rowCount };
  }

  async function resume(id: string, decs: ToolDecision[]) {
    await runRequest(`/api/conversations/${id}/resume`, { decisions: decs });
  }

  function onDecide(d: ToolDecision) {
    const next = { ...decisions, [d.toolUseId]: d };
    setDecisions(next);
    if (pending.length > 0 && pending.every((p) => next[p.toolUseId])) {
      const decs = pending.map((p) => next[p.toolUseId]);
      const id = conversationId;
      setPending([]);
      setDecisions({});
      if (id) void resume(id, decs);
    }
  }

  function newChat() {
    setConversationId(null);
    setBlocks([]);
    setPending([]);
    setDecisions({});
    setError(null);
  }

  const busy = streaming || pending.length > 0;

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const r = await uploadFile(file);
    if (r) await sendMessage(`I uploaded ${file.name}. What can you do with it?`, r.jobId);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const { conversations } = (await res.json()) as { conversations: ConversationLite[] };
      setConversations(conversations);
      if (conversations[0]) await openConversation(conversations[0].id);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [blocks, pending]);

  // Let other surfaces (e.g. the dashboard hero) send a prompt straight into the
  // Copilot. The panel stays mounted, so this listener is always live.
  const sendRef = useRef(sendMessage);
  useEffect(() => {
    sendRef.current = sendMessage;
  });
  useEffect(() => {
    const onPrompt = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text?.trim();
      if (text) void sendRef.current(text);
    };
    window.addEventListener("distru:copilot:prompt", onPrompt);
    return () => window.removeEventListener("distru:copilot:prompt", onPrompt);
  }, []);

  const empty = blocks.length === 0 && pending.length === 0;
  const wrap = compact ? "w-full px-4" : "mx-auto max-w-3xl px-6";

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {dragOver && (
        <div
          className="pointer-events-none absolute inset-0 z-30 m-2 grid place-items-center rounded-xl border-2 border-dashed text-sm font-medium"
          style={{
            borderColor: "var(--color-accent)",
            background: "color-mix(in oklab, var(--color-accent) 8%, var(--color-surface))",
            color: "var(--color-accent)",
          }}
        >
          Drop a CSV or XLSX to import
        </div>
      )}
      <header
        onPointerDown={onHeaderPointerDown}
        className={`flex items-center gap-2 border-b px-3 py-2.5 ${onHeaderPointerDown ? "cursor-move select-none" : ""}`}
      >
        {onHeaderPointerDown && <GripVertical size={15} className="text-muted" />}
        <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
        <span className="text-sm font-semibold">Copilot</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            className="btn btn-ghost px-2"
            title="History"
            onClick={() => setHistory((v) => !v)}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <History size={16} />
          </button>
          <button
            className="btn btn-ghost px-2"
            title="New chat"
            onClick={() => {
              newChat();
              setHistory(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MessageSquarePlus size={16} />
          </button>
          {onToggleExpand && (
            <button
              className="btn btn-ghost px-2"
              title={expanded ? "Shrink" : "Expand"}
              onClick={onToggleExpand}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
          {onClose && (
            <button
              className="btn btn-ghost px-2"
              title="Close (⌘/Ctrl+J)"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {history ? (
        <div className="flex-1 overflow-auto p-3">
          <div className="mb-2 flex items-center gap-1">
            <span className="px-2 text-sm font-medium">Chats</span>
            <button
              className="btn btn-ghost ml-auto gap-1 px-2 text-xs"
              onClick={() => setHistory(false)}
              title="Back to chat"
            >
              <ArrowLeft size={13} /> Back
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">No chats yet.</div>
          ) : (
            <div className="space-y-0.5">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    openConversation(c.id);
                    setHistory(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface2"
                  style={c.id === conversationId ? { background: "var(--color-surface2)" } : undefined}
                >
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(c.updatedAt)}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              router.push("/automations");
              setHistory(false);
              onClose?.();
            }}
            className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted transition-colors hover:bg-surface2 hover:text-fg"
          >
            <Workflow size={15} /> Automations
            <span className="ml-auto text-xs">Open page →</span>
          </button>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <div className={`${wrap} space-y-4 py-5`}>
              {empty && (
                <div>
                  <p className="mb-3 text-sm text-muted">
                    Ask about your inventory, make changes (with approval), drop a CSV to import, or
                    ask how something works.
                  </p>
                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="block w-full rounded-lg border px-3 py-2 text-left text-sm text-muted transition-colors hover:border-accent hover:text-[var(--color-fg)]"
                        style={{ background: "var(--color-bg)" }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {blocks.map((b, i) => (
                <BlockView key={i} block={b} />
              ))}

              {pending.map((p) => (
                <GateCard key={p.toolUseId} interrupt={p} decided={decisions[p.toolUseId]} onDecide={onDecide} />
              ))}

              {streaming && pending.length === 0 && <ThinkingDots />}
              {error && <div className="text-sm text-danger">{error}</div>}
            </div>
          </div>

          <Composer
            disabled={pending.length > 0}
            streaming={streaming}
            onStop={stop}
            onSend={sendMessage}
            onUpload={uploadFile}
          />
        </>
      )}
    </div>
  );
}
