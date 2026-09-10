"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  Cloud,
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  Plug,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  configureProviderAction,
  connectProviderAction,
  disconnectProviderAction,
  syncProviderAction,
} from "./actions";

type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required: boolean;
  secret?: boolean;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type Provider = {
  key: string;
  label: string;
  category: string;
  blurb: string;
  syncVerb: string;
  setupHint: string;
  configFields: ConfigField[];
  status: "connected" | "disconnected";
  configured: boolean;
  configValues: Record<string, string>;
  secretsSet: Record<string, boolean>;
  oauth: boolean;
  authorized: boolean;
  live: boolean;
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
  xero: Calculator,
  sage: Calculator,
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

// The states an operator sees, derived from configured + oauth + connected.
type ProviderState = "connected" | "ready" | "authorize" | "setup";
function stateOf(p: Provider): ProviderState {
  if (!p.configured) return "setup";
  if (p.oauth && !p.authorized) return "authorize"; // creds saved, needs OAuth
  return p.status === "connected" ? "connected" : "ready";
}

const STATE_META: Record<ProviderState, { label: string; color: string }> = {
  connected: { label: "Connected", color: "var(--color-accent)" },
  ready: { label: "Ready to connect", color: "#f59e0b" },
  authorize: { label: "Authorize", color: "#f59e0b" },
  setup: { label: "Setup required", color: "var(--color-muted)" },
};

/** The credential dialog for one provider. Secrets are shown as "saved"
 *  placeholders and only sent when the operator types a new value. */
function ConfigDialog({
  provider,
  open,
  onOpenChange,
  onSaved,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (msg: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...provider.configValues,
  }));
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function save() {
    setError(null);
    startSaving(async () => {
      // Only send fields with a value; blank secret fields keep the saved one.
      const patch: Record<string, string> = {};
      for (const f of provider.configFields) {
        const v = values[f.key] ?? "";
        if (f.secret) {
          if (v.trim() !== "") patch[f.key] = v.trim();
        } else {
          patch[f.key] = v.trim();
        }
      }
      const res = await configureProviderAction(provider.key, patch);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      onSaved(
        res.configured
          ? `${provider.label} is set up and connected.`
          : `Saved. ${provider.label} still needs: ${(res.missing ?? []).join(", ") || "more details"}.`,
      );
      onOpenChange(false);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <KeyRound size={15} className="text-muted" /> Configure {provider.label}
        </span>
      }
      description={`Enter credentials for ${provider.label}`}
      className="max-w-lg"
    >
      <div className="max-h-[70vh] overflow-auto p-4">
        <p className="mb-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted">
          {provider.setupHint}
        </p>

        <div className="grid gap-3">
          {provider.configFields.map((f) => {
            const savedSecret = f.secret && provider.secretsSet[f.key];
            return (
              <label key={f.key} className="grid gap-1 text-sm">
                <span className="font-medium">
                  {f.label}
                  {f.required ? <span className="text-danger"> *</span> : <span className="text-muted"> (optional)</span>}
                </span>
                {f.type === "select" ? (
                  <Select
                    value={values[f.key] ?? ""}
                    onValueChange={(v) => set(f.key, v)}
                    options={f.options ?? []}
                    placeholder="Select…"
                    ariaLabel={f.label}
                  />
                ) : (
                  <input
                    className="input"
                    type={f.type === "password" ? "password" : f.type === "url" ? "url" : "text"}
                    value={values[f.key] ?? ""}
                    placeholder={savedSecret ? "•••••••• (saved — leave blank to keep)" : f.placeholder}
                    autoComplete="off"
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                )}
                {f.help && <span className="text-xs text-muted">{f.help}</span>}
              </label>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-muted">
          Credentials are stored on your workspace and used only to reach this
          provider. This demo keeps them in the connection record; a production
          deployment would put secrets in a dedicated secret store.
        </p>

        {error && <div className="mt-3 rounded-lg border border-danger/40 px-3 py-2 text-xs text-danger">{error}</div>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary px-3 py-1.5 text-sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            Save credentials
          </button>
        </div>
      </div>
    </Modal>
  );
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
  const [flash, setFlash] = useState<{ key: string; message: string; error?: boolean } | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);

  // Surface the OAuth callback outcome (?connected=<provider> / ?error=<msg>) and
  // strip it from the URL so a refresh doesn't repeat it.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const connected = q.get("connected");
    const error = q.get("error");
    if (!connected && !error) return;
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlash(
      connected
        ? { key: connected, message: "Connected — the live vendor API is now wired." }
        : { key: error as string, message: error as string, error: true },
    );
  }, []);

  const connectedCount = providers.filter((p) => p.status === "connected").length;

  function run(action: () => Promise<{ ok: boolean; error?: string; summary?: string }>, key: string, label: string) {
    setBusy(`${key}:${label}`);
    setFlash(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) {
          setFlash({ key, message: res.error ?? "Something went wrong.", error: true });
        } else if (label === "sync" && res.summary) {
          setFlash({ key, message: res.summary });
        }
      } finally {
        setBusy(null);
      }
    });
  }

  const configuringProvider = providers.find((p) => p.key === configuring) ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="badge" style={{ color: "var(--color-accent)" }}>
          {connectedCount} connected
        </span>
        <span>
          of {providers.length} available providers. Set up a provider&rsquo;s
          credentials to connect it - the same seam a live adapter drops into.
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((p) => {
          const st = stateOf(p);
          const meta = STATE_META[st];
          const isSyncing = busy === `${p.key}:sync`;
          const isToggling = busy === `${p.key}:connect` || busy === `${p.key}:disconnect`;
          const Icon = iconFor(p.key);
          return (
            <div
              key={p.key}
              className="card flex h-full flex-col transition-colors data-[on=true]:border-accent"
              data-on={st === "connected"}
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
                <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
                  <span className="badge flex items-center gap-1" style={{ color: meta.color }}>
                    <span className="inline-block size-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                  {p.live && (
                    <span className="badge text-[10px]" style={{ color: "var(--color-accent)", borderColor: "var(--color-accent)" }} title="Runs against the live vendor API">
                      ● Live
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-2.5 flex-1 text-sm text-muted">{p.blurb}</p>

              {st === "connected" && (
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
                  style={{ color: flash.error ? "var(--color-danger)" : "var(--color-accent)" }}
                >
                  {flash.message}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                {st === "setup" ? (
                  <button className="btn btn-primary px-3 py-1.5 text-sm" onClick={() => setConfiguring(p.key)}>
                    <Settings2 size={14} /> Set up
                  </button>
                ) : st === "authorize" ? (
                  <>
                    <a className="btn btn-primary px-3 py-1.5 text-sm" href={`/api/integrations/${p.key}/authorize`}>
                      <Plug size={14} /> Connect with {p.label}
                    </a>
                    <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setConfiguring(p.key)}>
                      <Settings2 size={14} /> Configure
                    </button>
                  </>
                ) : st === "ready" ? (
                  <>
                    <button
                      className="btn btn-primary px-3 py-1.5 text-sm"
                      disabled={pending}
                      onClick={() => run(() => connectProviderAction(p.key), p.key, "connect")}
                    >
                      {isToggling ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
                      Connect
                    </button>
                    <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setConfiguring(p.key)}>
                      <Settings2 size={14} /> Configure
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-primary px-3 py-1.5 text-sm"
                      disabled={pending}
                      onClick={() => run(() => syncProviderAction(p.key), p.key, "sync")}
                      title={p.syncVerb}
                    >
                      {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                      Sync now
                    </button>
                    <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => setConfiguring(p.key)}>
                      <Settings2 size={14} /> Configure
                    </button>
                    <button
                      className="btn btn-ghost px-3 py-1.5 text-sm"
                      disabled={pending}
                      onClick={() => run(() => disconnectProviderAction(p.key), p.key, "disconnect")}
                    >
                      {isToggling ? <Loader2 size={14} className="animate-spin" /> : null}
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {configuringProvider && (
        <ConfigDialog
          provider={configuringProvider}
          open={configuring !== null}
          onOpenChange={(o) => !o && setConfiguring(null)}
          onSaved={(message) => setFlash({ key: configuringProvider.key, message })}
        />
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold">Sync activity</h2>
      {events.length === 0 ? (
        <div className="card text-sm text-muted">
          No sync activity yet. Set up and connect a provider, then hit{" "}
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
                  <span className="shrink-0 text-xs text-muted">{relativeTime(e.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
