"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, Search, Sparkles } from "lucide-react";
import { breadcrumbTrail } from "@/components/nav-config";

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

  return (
    <div className="relative z-20 flex flex-1 items-center gap-3 px-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
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
          className="input py-1.5 pl-9 pr-12 text-sm"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] text-muted">
          ⌘K
        </span>
      </form>

      <button
        className="relative rounded-lg p-2 hover:bg-[var(--color-surface2)]"
        onClick={() => setBell((v) => !v)}
        aria-label="Notifications"
      >
        <Bell size={18} className="text-muted" />
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full" style={{ background: "var(--color-accent)" }} />
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
      >
        <Sparkles size={16} />
        Copilot
        <span className="text-[11px] opacity-70">⌘J</span>
      </button>

      {bell && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setBell(false)} />
          <div
            className="absolute right-3 top-full z-20 mt-1 w-56 rounded-xl border p-1 shadow-lg"
            style={{ background: "var(--color-surface)" }}
          >
            <div className="px-3 py-6 text-center text-sm text-muted">You&apos;re all caught up.</div>
          </div>
        </>
      )}
    </div>
  );
}
