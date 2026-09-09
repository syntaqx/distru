"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Status = { resetEnabled: boolean; nextResetAt: string | null };

function until(nextResetAt: string): string {
  const ms = new Date(nextResetAt).getTime() - Date.now();
  if (ms <= 0) return "moments";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

/**
 * Shows how long until the demo environment resets - but only on deployments
 * where the nightly reset is actually enabled (it self-fetches `/api/demo-status`
 * and renders nothing otherwise, so local dev / real deployments stay clean).
 */
export function DemoResetNotice({ variant = "banner" }: { variant?: "banner" | "pill" }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/demo-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => alive && d && setStatus(d))
      .catch(() => {});
    // Re-render each minute so the countdown ticks down.
    const t = setInterval(() => alive && tick((n) => n + 1), 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!status?.resetEnabled || !status.nextResetAt) return null;
  const left = until(status.nextResetAt);

  if (variant === "pill") {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted"
        title="This is a shared demo. It resets to a fresh state nightly (00:00 UTC)."
      >
        <RefreshCw size={11} className="shrink-0" />
        <span>Demo resets in {left}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted">
      <RefreshCw size={13} className="mt-0.5 shrink-0" style={{ color: "var(--color-accent)" }} />
      <span>
        This is a shared demo - anything you change is wiped and reseeded to a fresh state every night
        (00:00 UTC). Next reset in <span className="font-medium text-fg">{left}</span>.
      </span>
    </div>
  );
}
