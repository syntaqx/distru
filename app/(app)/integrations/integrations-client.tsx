"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Trash2, Webhook } from "lucide-react";
import {
  createTokenAction,
  createWebhookAction,
  deleteWebhookAction,
  revokeTokenAction,
} from "./actions";

type Token = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
};
type Endpoint = { id: string; url: string; events: string[]; active: boolean };
type Delivery = {
  id: string;
  eventType: string;
  status: string;
  responseStatus: number | null;
  createdAt: string;
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-auto rounded-lg border p-3 pr-10 text-xs" style={{ background: "var(--color-bg)" }}>
        <code>{code}</code>
      </pre>
      <button
        className="btn btn-ghost absolute right-1.5 top-1.5 px-2 py-1"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        aria-label="Copy"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export function IntegrationsClient({
  tokens,
  endpoints,
  deliveries,
  appUrl,
}: {
  tokens: Token[];
  endpoints: Endpoint[];
  deliveries: Delivery[];
  appUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["products:read", "products:write"]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const sampleToken = newToken ?? "dk_live_YOUR_TOKEN";

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Section title="API tokens" icon={<KeyRound size={16} style={{ color: "var(--color-accent)" }} />}>
        <div className="card space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="label">Token name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. QuickBooks sync" />
            </div>
            <div className="flex gap-3 pb-2">
              {["products:read", "products:write"].map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm text-muted">
                  <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                  {s}
                </label>
              ))}
            </div>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { token } = await createTokenAction(name, scopes);
                  setNewToken(token);
                  setName("");
                })
              }
            >
              Create token
            </button>
          </div>
          {newToken && (
            <div className="rounded-lg border border-dashed p-3">
              <div className="mb-1 text-xs text-muted">Copy this now - it won&apos;t be shown again.</div>
              <CodeBlock code={newToken} />
            </div>
          )}
        </div>

        {tokens.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Token</th>
                  <th className="px-4 py-2 font-medium">Scopes</th>
                  <th className="px-4 py-2 font-medium">Last used</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-t" style={{ background: "var(--color-bg)" }}>
                    <td className="px-4 py-2 font-medium">{t.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted">{t.prefix}…</td>
                    <td className="px-4 py-2 text-xs">{t.scopes.join(", ")}</td>
                    <td className="px-4 py-2 text-xs text-muted">
                      {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : "never"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="btn btn-danger px-2 py-1 text-xs"
                        onClick={() => startTransition(() => revokeTokenAction(t.id))}
                      >
                        <Trash2 size={13} /> Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Public REST API (Distru-compatible)" icon={<span className="text-[var(--color-accent)]">{"{}"}</span>}>
        <p className="mb-2 text-sm text-muted">List products (Bearer auth, `page[number]` pagination, string-numbers):</p>
        <CodeBlock code={`curl -H "Authorization: Bearer ${sampleToken}" \\\n  ${appUrl}/public/v1/products`} />
        <p className="mb-2 mt-4 text-sm text-muted">Sparse upsert a product (omit id to create, include to update):</p>
        <CodeBlock
          code={`curl -X POST ${appUrl}/public/v1/products \\\n  -H "Authorization: Bearer ${sampleToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Gelato 3.5g","sku":"FL-GEL-35","category":"Flower","vendor":"Sungrown Farms","unit_type":"Gram","unit_price":34}'`}
        />
        <p className="mb-2 mt-4 text-sm text-muted">Post a stock adjustment:</p>
        <CodeBlock
          code={`curl -X POST ${appUrl}/public/v1/stock-adjustments \\\n  -H "Authorization: Bearer ${sampleToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"sku":"FL-BD-35","quantity_delta":25}'`}
        />
        <p className="mb-2 mt-4 text-sm text-muted">Bulk upload (chunk → validate → partial upload → error CSV):</p>
        <CodeBlock code={`curl -X POST ${appUrl}/api/upload-products \\\n  -H "Authorization: Bearer ${sampleToken}" \\\n  -F file=@catalog.csv`} />
      </Section>

      <Section title="MCP server (drive Distru from your own agent)" icon={<span className="text-[var(--color-accent)]">◇</span>}>
        <p className="mb-2 text-sm text-muted">Add to any MCP client (Claude Desktop, Cursor, your own agent):</p>
        <CodeBlock
          code={JSON.stringify(
            {
              mcpServers: {
                distru: {
                  url: `${appUrl}/api/mcp`,
                  headers: { Authorization: `Bearer ${sampleToken}` },
                },
              },
            },
            null,
            2,
          )}
        />
      </Section>

      <Section title="Webhooks (HMAC-signed)" icon={<Webhook size={16} style={{ color: "var(--color-accent)" }} />}>
        <div className="card space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Endpoint URL</label>
              <input className="input" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/hooks/distru" />
            </div>
            <button
              className="btn btn-primary"
              disabled={pending || !webhookUrl}
              onClick={() =>
                startTransition(async () => {
                  const { secret } = await createWebhookAction(webhookUrl, ["product.created", "product.updated"]);
                  setNewSecret(secret);
                  setWebhookUrl("");
                })
              }
            >
              Add endpoint
            </button>
          </div>
          {newSecret && (
            <div className="rounded-lg border border-dashed p-3">
              <div className="mb-1 text-xs text-muted">Signing secret (x-distru-signature: sha256=HMAC):</div>
              <CodeBlock code={newSecret} />
            </div>
          )}
        </div>

        {endpoints.length > 0 && (
          <div className="mt-3 space-y-2">
            {endpoints.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--color-surface)" }}>
                <span className="badge" style={{ color: e.active ? "var(--color-accent)" : "var(--color-muted)" }}>
                  {e.active ? "active" : "off"}
                </span>
                <span className="font-mono text-xs">{e.url}</span>
                <span className="text-xs text-muted">{e.events.join(", ")}</span>
                <button className="btn btn-danger ml-auto px-2 py-1 text-xs" onClick={() => startTransition(() => deleteWebhookAction(e.id))}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {deliveries.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-muted">Recent deliveries</div>
            <div className="space-y-1">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-3 text-xs">
                  <span
                    className="badge"
                    style={{ color: d.status === "success" ? "var(--color-accent)" : "var(--color-danger)" }}
                  >
                    {d.status}
                    {d.responseStatus ? ` ${d.responseStatus}` : ""}
                  </span>
                  <span>{d.eventType}</span>
                  <span className="text-muted">{new Date(d.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
