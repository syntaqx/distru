"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  ScrollText,
  Search,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { breadcrumbTrail } from "@/components/nav-config";
import { timeAgo } from "@/lib/format";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

function NotifIcon({ kind }: { kind: string }) {
  if (kind === "workflow.error")
    return <XCircle size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-danger)" }} />;
  if (kind === "delivery.sent")
    return <Send size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />;
  if (kind === "report.ready")
    return <ScrollText size={15} className="mt-0.5 shrink-0 text-muted" />;
  return <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />;
}

export function TopBar({
  onToggleCopilot,
  copilotOpen,
}: {
  onToggleCopilot: () => void;
  copilotOpen: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const crumbs = breadcrumbTrail(pathname);
  const [query, setQuery] = useState("");
  const [bell, setBell] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const fetchNotifs = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const d = (await res.json()) as { notifications: Notif[]; unread: number };
    setNotifs(d.notifications);
    setUnread(d.unread);
  }, []);

  // Poll, and refresh right after a Copilot turn (which may have finished a run).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNotifs();
    const t = setInterval(fetchNotifs, 30000);
    const onDone = () => setTimeout(fetchNotifs, 500);
    window.addEventListener("distru:copilot:done", onDone);
    window.addEventListener("distru:notifications:changed", fetchNotifs);
    return () => {
      clearInterval(t);
      window.removeEventListener("distru:copilot:done", onDone);
      window.removeEventListener("distru:notifications:changed", fetchNotifs);
    };
  }, [fetchNotifs]);

  async function openNotif(n: Notif) {
    setBell(false);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
    }
    if (n.href) router.push(n.href);
  }

  async function markAllRead() {
    setUnread(0);
    setNotifs((prev) => prev.map((x) => ({ ...x, read: true })));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <div className="relative z-20 flex flex-1 items-center gap-2 px-2 sm:gap-3 sm:px-4">
      <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-sm sm:flex">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={13} className="text-muted" />}
              {c.href && !last ? (
                <Link href={c.href} className="text-muted transition-colors hover:text-fg">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "font-medium" : "text-muted"}>{c.label}</span>
              )}
            </span>
          );
        })}
      </nav>

      <form
        className="relative ml-auto w-full max-w-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) router.push(`/inventory?q=${encodeURIComponent(query.trim())}`);
        }}
      >
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="input py-1.5 pl-9 pr-3 text-sm sm:pr-12"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] text-muted sm:block">
          ⌘K
        </span>
      </form>

      <button
        className="relative rounded-lg p-2 hover:bg-surface2"
        onClick={() => {
          setBell((v) => !v);
          void fetchNotifs();
        }}
        aria-label="Notifications"
      >
        <Bell size={18} className="text-muted" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold leading-4"
            style={{ background: "var(--color-accent)", color: "var(--color-accentfg)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <button
        onClick={onToggleCopilot}
        className="btn text-sm"
        style={
          copilotOpen
            ? { background: "var(--color-accent)", color: "var(--color-accentfg)" }
            : { background: "var(--color-surface2)", color: "var(--color-fg)" }
        }
        title="Toggle Copilot (⌘/Ctrl+J)"
        aria-label="Toggle Copilot"
      >
        <Sparkles size={16} />
        <span className="hidden sm:inline">Copilot</span>
        <span className="hidden text-[11px] opacity-70 sm:inline">⌘J</span>
      </button>

      {bell && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setBell(false)} />
          <div
            className="absolute right-3 top-full z-20 mt-1 flex max-h-[70vh] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border shadow-lg"
            style={{ background: "var(--color-surface)" }}
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <button className="text-xs text-muted transition-colors hover:text-fg" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-1">
              {notifs.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted">You&apos;re all caught up.</div>
              ) : (
                notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotif(n)}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface2"
                  >
                    <NotifIcon kind={n.kind} />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${n.read ? "text-muted" : "font-medium"}`}>{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read && (
                      <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: "var(--color-accent)" }} />
                    )}
                  </button>
                ))
              )}
            </div>
            <Link
              href="/notifications"
              onClick={() => setBell(false)}
              className="border-t px-3 py-2 text-center text-xs font-medium text-muted transition-colors hover:text-fg"
            >
              See all notifications
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
