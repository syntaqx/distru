"use client";

import { useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Cloud,
  Fingerprint,
  Loader2,
  Mail,
  Plug,
  RefreshCw,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  connectProviderAction,
  disconnectProviderAction,
  syncProviderAction,
} from "./actions";

type Provider = {
  key: string;
  label: string;
  category: string;
  blurb: string;
  syncVerb: string;
  status: "connected" | "disconnected";
  connectedAt: string | null;
  lastSyncedAt: string | null;
};

type SyncEvent = {
  id: string;
  provider: string;
  direction: "push" | "pull";
  entityType: string;
  summary: string;
  status: "success" | "error";
  createdAt: string;
};

const ICONS: Record<string, LucideIcon> = {
  quickbooks: Calculator,
  metrc: ShieldCheck,
  leaflink: Store,
  biotrack: Fingerprint,
  onfleet: Truck,
  email: Mail,
  google_drive: Cloud,
};

function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? Plug;
}

function labelFor(providers: Provider[], key: string): string {
  return providers.find((p) => p.key === key)?.label ?? key;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function IntegrationsClient({
  providers,
  events,
}: {
  providers: Provider[];
  events: SyncEvent[];
}) {
  const [pending, startTransition] = useTransition();
  // The provider key + action currently running, so only that card spins.
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ key: string; message: string } | null>(null);

  const connectedCount = providers.filter((p) => p.status === "connected").length;

  function run(action: () => Promise<unknown>, key: string, label: string) {
    setBusy(`${key}:${label}`);
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (label === "sync" && res && typeof res === "object" && "summary" in res) {
          setFlash({ key, message: String((res as { summary: string }).summary) });
        }
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="badge" style={{ color: "var(--color-accent)" }}>
          {connectedCount} connected
        </span>
        <span>
          of {providers.length} available providers - mock adapters that behave
          like the real vendor APIs.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((p) => {
          const Icon = iconFor(p.key);
          const connected = p.status === "connected";
          const isSyncing = busy === `${p.key}:sync`;
          const isToggling = busy === `${p.key}:connect` || busy === `${p.key}:disconnect`;
          return (
            <div
              key={p.key}
              className="card flex h-full flex-col transition-colors data-[on=true]:border-accent"
              data-on={connected}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg"
                  style={{ background: "var(--color-surface2)" }}
                >
                  <Icon size={18} style={{ color: "var(--color-accent)" }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.label}</div>
                  <div className="text-xs text-muted">{p.category}</div>
                </div>
                <span
                  className="badge ml-auto flex shrink-0 items-center gap-1"
                  style={{ color: connected ? "var(--color-accent)" : "var(--color-muted)" }}
                >
                  <span
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: connected ? "var(--color-accent)" : "var(--color-muted)" }}
                  />
                  {connected ? "Connected" : "Not connected"}
                </span>
              </div>

              <p className="mt-2.5 flex-1 text-sm text-muted">{p.blurb}</p>

              {connected && (
                <div className="mt-2 text-xs text-muted">
                  Last synced:{" "}
                  <span className="font-medium" style={{ color: "var(--color-fg)" }}>
                    {p.lastSyncedAt ? relativeTime(p.lastSyncedAt) : "never"}
                  </span>
                </div>
              )}

              {flash && flash.key === p.key && (
                <div
                  className="mt-2 rounded-lg border border-dashed px-2.5 py-1.5 text-xs"
                  style={{ color: "var(--color-accent)" }}
                >
                  {flash.message}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 pt-1">
                {connected ? (
                  <>
                    <button
                      className="btn btn-primary px-3 py-1.5 text-sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => syncProviderAction(p.key), p.key, "sync")
                      }
                      title={p.syncVerb}
                    >
                      {isSyncing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Sync now
                    </button>
                    <button
                      className="btn btn-ghost px-3 py-1.5 text-sm"
                      disabled={pending}
                      onClick={() =>
                        run(() => disconnectProviderAction(p.key), p.key, "disconnect")
                      }
                    >
                      {isToggling ? <Loader2 size={14} className="animate-spin" /> : null}
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary px-3 py-1.5 text-sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => connectProviderAction(p.key), p.key, "connect")
                    }
                  >
                    {isToggling ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plug size={14} />
                    )}
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Sync activity</h2>
      {events.length === 0 ? (
        <div className="card text-sm text-muted">
          No sync activity yet. Connect a provider and hit{" "}
          <span className="font-medium">Sync now</span> to see push and pull
          events land here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <ul className="divide-y">
            {events.map((e) => {
              const DirIcon = e.direction === "push" ? ArrowUpRight : ArrowDownLeft;
              const err = e.status === "error";
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ background: "var(--color-bg)" }}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-full"
                    style={{
                      background: "var(--color-surface2)",
                      color: err ? "var(--color-danger)" : "var(--color-accent)",
                    }}
                  >
                    <DirIcon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      <span className="font-medium">{labelFor(providers, e.provider)}</span>{" "}
                      <span className="text-muted">- {e.summary}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {e.direction === "push" ? "Pushed" : "Pulled"} - {e.entityType}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {relativeTime(e.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
