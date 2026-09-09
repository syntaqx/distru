"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** The reporting windows exposed by the sales analytics `Period` type. */
const PERIODS: { value: string; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "12m", label: "12M" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

/**
 * A relative-window toggle that drives every analytics query on the page via a
 * `?period=` search param. Mirrors the segmented control used on the Sales page;
 * the server page re-renders with the new window on each change.
 */
export function PeriodTabs({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function select(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("period");
    else next.set("period", value);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `/insights?${qs}` : "/insights"));
  }

  return (
    <div
      className="flex rounded-lg border p-0.5"
      style={{ background: "var(--color-surface)", opacity: pending ? 0.6 : 1 }}
    >
      {PERIODS.map((p) => {
        const active = p.value === current;
        return (
          <button
            key={p.value}
            onClick={() => select(p.value)}
            disabled={pending}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active ? "text-fg" : "text-muted hover:text-fg"
            }`}
            style={active ? { background: "var(--color-surface2)" } : undefined}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
