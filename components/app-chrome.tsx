"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { OrgSwitcher } from "@/components/org-switcher";
import { CopilotPanel } from "@/components/chat/copilot-panel";
import { ThemeProvider } from "@/components/theme";
import { TopProgress } from "@/components/top-progress";

const STORAGE_KEY = "distru:copilot:open";

/**
 * App shell. A full-width top bar whose left segment (aligned over the sidebar)
 * holds the Cloudflare-style workspace switcher; below it the sidebar + page.
 * The Copilot is a floating, draggable window (not a page-pushing dock).
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
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener("distru:copilot:open", onOpen);
    window.addEventListener("distru:copilot:toggle", onToggle);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("distru:copilot:open", onOpen);
      window.removeEventListener("distru:copilot:toggle", onToggle);
    };
  }, []);

  return (
    <ThemeProvider>
      <Suspense fallback={null}>
        <TopProgress />
      </Suspense>
      <div className="flex h-dvh flex-col overflow-hidden">
        <div className="flex h-14 shrink-0 border-b" style={{ background: "var(--color-surface)" }}>
          <div className="flex w-64 shrink-0 items-center border-r px-2">
            <OrgSwitcher initialName={orgName} />
          </div>
          <TopBar onToggleCopilot={() => setOpen((v) => !v)} copilotOpen={open} />
        </div>

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <Sidebar userName={userName} userEmail={userEmail} />
          <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
        </div>
      </div>

      <CopilotPanel open={open} onClose={() => setOpen(false)} />
    </ThemeProvider>
  );
}
