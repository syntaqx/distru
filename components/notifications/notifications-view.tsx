"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, ScrollText, Send, XCircle, CheckCircle2 } from "lucide-react";
import { timeAgo } from "@/lib/format";

export type NotifLite = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

function Icon({ kind }: { kind: string }) {
  if (kind === "workflow.error")
    return <XCircle size={16} className="shrink-0" style={{ color: "var(--color-danger)" }} />;
  if (kind === "delivery.sent") return <Send size={16} className="shrink-0" style={{ color: "var(--color-accent)" }} />;
  if (kind === "report.ready") return <ScrollText size={16} className="shrink-0 text-muted" />;
  return <CheckCircle2 size={16} className="shrink-0" style={{ color: "var(--color-accent)" }} />;
}

async function post(body: unknown) {
  await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Keep the topbar bell in sync.
  window.dispatchEvent(new CustomEvent("distru:notifications:changed"));
}

export function NotificationsView({ initial }: { initial: NotifLite[] }) {
  const router = useRouter();
  const [items, setItems] = useState<NotifLite[]>(initial);
  const [tab, setTab] = useState<"all" | "unread">("all");

  const unread = items.filter((n) => !n.read).length;
  const shown = tab === "unread" ? items.filter((n) => !n.read) : items;

  function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void post({ ids: [id] });
  }

  function open(n: NotifLite) {
    if (!n.read) markRead(n.id);
    if (n.href) router.push(n.href);
  }

  function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    void post({ all: true });
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-5">
      <div className="mb-3 flex items-center gap-1">
        <button
          onClick={() => setTab("all")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "all" ? "text-fg" : "text-muted hover:text-fg"
          }`}
          style={tab === "all" ? { background: "var(--color-surface2)" } : undefined}
        >
          All
        </button>
        <button
          onClick={() => setTab("unread")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "unread" ? "text-fg" : "text-muted hover:text-fg"
          }`}
          style={tab === "unread" ? { background: "var(--color-surface2)" } : undefined}
        >
          Unread {unread > 0 && <span className="ml-1 text-xs text-muted">{unread}</span>}
        </button>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
          >
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        {shown.length === 0 ? (
          <div className="grid h-full min-h-40 place-items-center p-10 text-center">
            <div>
              <Bell size={22} className="mx-auto text-muted" />
              <p className="mt-2 text-sm text-muted">
                {tab === "unread" ? "No unread notifications." : "No notifications yet."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {shown.map((n) => (
              <li
                key={n.id}
                className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface2"
                style={n.read ? undefined : { background: "color-mix(in srgb, var(--color-accent) 6%, transparent)" }}
              >
                <span className="mt-0.5">
                  <Icon kind={n.kind} />
                </span>
                <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                  <span className={`block text-sm ${n.read ? "text-muted" : "font-medium"}`}>{n.title}</span>
                  {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.read && (
                    <>
                      <span className="size-2 rounded-full" style={{ background: "var(--color-accent)" }} />
                      <button
                        onClick={() => markRead(n.id)}
                        title="Mark as read"
                        className="rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-surface hover:text-fg group-hover:opacity-100"
                      >
                        <Check size={15} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
