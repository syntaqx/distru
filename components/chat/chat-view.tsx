"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader, MessageSquarePlus, Sparkles, X } from "lucide-react";
import { readNdjson } from "@/lib/ndjson-client";
import type { HarnessEvent, Interrupt, ToolDecision } from "@/lib/harness/types";
import { BlockView, type ChatBlock } from "./blocks";
import { GateCard } from "./gate-cards";
import { Composer } from "./composer";

type ConversationLite = { id: string; title: string };

const SUGGESTIONS = [
  "What are my top categories and how much stock do I have?",
  "Add a product: Gelato 3.5g, SKU FL-GEL-35, Flower, vendor Sungrown Farms, unit gram, $34",
  "Set on-hand for Blue Dream 3.5g to 200",
  "Upload a CSV - a catalog, price sheet, customer/vendor list, or inventory count",
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
}: {
  compact?: boolean;
  onClose?: () => void;
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  async function streamResponse(res: Response) {
    setStreaming(true);
    await readNdjson(res, applyEvent);
    setStreaming(false);
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
    const res = await fetch(`/api/conversations/${id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, importJobId, pageContext: pageLabel(pathname) }),
    });
    await streamResponse(res);
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
    const res = await fetch(`/api/conversations/${id}/resume`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decisions: decs }),
    });
    await streamResponse(res);
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

  const empty = blocks.length === 0 && pending.length === 0;
  const wrap = compact ? "w-full px-4" : "mx-auto max-w-3xl px-6";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles size={16} style={{ color: "var(--color-accent)" }} />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-none">Copilot</h1>
          {!compact && (
            <p className="mt-1 text-xs text-muted">Ask about your data, change inventory, or import a file.</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {!compact && conversations.length > 0 && (
            <select
              className="input max-w-55 py-1.5 text-sm"
              value={conversationId ?? ""}
              onChange={(e) => e.target.value && openConversation(e.target.value)}
            >
              <option value="" disabled>
                History…
              </option>
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-ghost px-2" title="New chat" onClick={newChat}>
            <MessageSquarePlus size={16} />
          </button>
          {onClose && (
            <button className="btn btn-ghost px-2" title="Close (⌘/Ctrl+J)" onClick={onClose}>
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div className={`${wrap} space-y-4 py-6`}>
          {empty && (
            <div className="mt-6 text-center">
              <Sparkles size={26} className="mx-auto" style={{ color: "var(--color-accent)" }} />
              <h2 className="mt-2 text-base font-semibold">How can I help?</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Query your inventory, make changes (with your approval), or drop a CSV - I&apos;ll
                detect what it is and ask what to do.
              </p>
              <div className={`mx-auto mt-4 grid max-w-xl gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="card text-left text-sm hover:border-accent"
                    onClick={() => sendMessage(s)}
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

          {streaming && pending.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Loader size={13} className="animate-spin" style={{ color: "var(--color-accent)" }} />
              working…
            </div>
          )}
          {error && <div className="text-sm text-danger">{error}</div>}
        </div>
      </div>

      <Composer disabled={streaming || pending.length > 0} onSend={sendMessage} onUpload={uploadFile} />
    </div>
  );
}
