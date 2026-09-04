"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ChatView } from "@/components/chat/chat-view";

const STORAGE_KEY = "distru:copilot:open";

/**
 * The app shell: sidebar + page content + a dockable Copilot on the right. The
 * dock lives beside whatever page you're on (it pushes content, doesn't take
 * over), and any "Ask the Copilot" button opens it via a window event.
 */
export function AppChrome({
  orgName,
  userName,
  userEmail,
  children,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Restore the dock's open/closed state after hydration (reading localStorage
  // in a useState initializer would cause an SSR/client hydration mismatch).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {}
  }, [open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onToggle = () => setOpen((v) => !v);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("distru:copilot:open", onOpen);
    window.addEventListener("distru:copilot:toggle", onToggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("distru:copilot:open", onOpen);
      window.removeEventListener("distru:copilot:toggle", onToggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        orgName={orgName}
        userName={userName}
        userEmail={userEmail}
        onToggleCopilot={() => setOpen((v) => !v)}
        copilotOpen={open}
      />
      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>

      <aside
        className="shrink-0 overflow-hidden border-l transition-[width] duration-200 ease-out"
        style={{ width: open ? "min(440px, 92vw)" : 0, background: "var(--color-surface)" }}
        aria-hidden={!open}
      >
        <div className="h-full" style={{ width: "min(440px, 92vw)" }}>
          <ChatView compact onClose={() => setOpen(false)} />
        </div>
      </aside>

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="btn btn-primary fixed bottom-5 right-5 z-20 rounded-full px-4 py-3 shadow-lg"
          title="Open Copilot (⌘/Ctrl+J)"
        >
          <Sparkles size={18} />
          <span className="text-sm font-medium">Ask Copilot</span>
        </button>
      )}
    </div>
  );
}
