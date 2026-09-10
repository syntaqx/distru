"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Save } from "lucide-react";

/**
 * One Available-report row: the label + a link that opens the live JSON (the API
 * response), and a "Save to Reports" action that snapshots the report into a
 * durable artifact and jumps to it - the bridge between Insights and Reports.
 */
export function ReportRow({ name, label }: { name: string; label: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: name }),
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        router.push(url);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="group flex items-center gap-1.5 text-sm">
      <a
        href={`/api/v1/reports/${name}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-1.5 text-info hover:underline"
      >
        <span className="truncate">{label}</span>
        <ExternalLink size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </a>
      <button
        onClick={save}
        disabled={saving}
        title="Save a snapshot to Reports"
        className="shrink-0 rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-surface2 hover:text-fg group-hover:opacity-100"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
      </button>
    </li>
  );
}
