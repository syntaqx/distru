"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { timeAgo } from "@/lib/format";

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorType: string;
  actorId: string | null;
  label: string | null;
  createdAt: string;
};

function actionLabel(action: string) {
  const map: Record<string, string> = {
    "product.create": "Created product",
    "product.update": "Updated product",
    "product.delete": "Deleted product",
    "inventory.adjust": "Adjusted inventory",
    "category.create": "Created category",
    "category.update": "Updated category",
    "company.create": "Created company",
    "company.update": "Updated company",
    "company.delete": "Deleted company",
    "order.create": "Created order",
    "order.status": "Updated order",
    "order.cancel": "Cancelled order",
    "invoice.create": "Created invoice",
    "payment.record": "Recorded payment",
    "api_token.create": "Created API token",
    "api_token.revoke": "Revoked API token",
    "driver.create": "Created driver",
    "driver.update": "Updated driver",
    "vehicle.create": "Created vehicle",
    "vehicle.update": "Updated vehicle",
  };
  if (map[action]) return map[action];
  // Fallback: humanize "entity.verb" → "Verb entity"
  const [entity, verb] = action.split(".");
  if (entity && verb) {
    const v = verb.charAt(0).toUpperCase() + verb.slice(1);
    return `${v} ${entity.replace(/_/g, " ")}`;
  }
  return action;
}

function shortId(id: string | null) {
  if (!id) return "—";
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function AuditLogView({ entries }: { entries: AuditEntry[] }) {
  const [q, setQ] = useState("");

  const query = q.toLowerCase();
  const filtered = entries.filter((e) => {
    if (!query) return true;
    return (
      actionLabel(e.action).toLowerCase().includes(query) ||
      e.action.toLowerCase().includes(query) ||
      e.entityType.toLowerCase().includes(query) ||
      (e.entityId ?? "").toLowerCase().includes(query) ||
      (e.actorId ?? "").toLowerCase().includes(query) ||
      e.actorType.toLowerCase().includes(query) ||
      (e.label ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by action or entity..."
          />
        </div>
        <span className="ml-auto text-xs text-muted">
          {filtered.length} of {entries.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-140 text-sm">
          <thead>
            <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Actor</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <div className="font-medium">{timeAgo(e.createdAt)}</div>
                  <div className="text-xs text-muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className="badge text-[10px]">{e.actorType}</span>
                  {e.actorId && (
                    <div className="mt-0.5 font-mono text-xs text-muted">{shortId(e.actorId)}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 font-medium">{actionLabel(e.action)}</td>
                <td className="px-4 py-2.5">
                  <span>{e.label ?? e.entityType}</span>
                  <div className="mt-0.5 font-mono text-xs text-muted">
                    {e.entityType} · {shortId(e.entityId)}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted">
                  {entries.length === 0
                    ? "No activity recorded yet."
                    : "No entries match your filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
