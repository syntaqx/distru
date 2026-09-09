"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import {
  createTokenAction,
  revokeTokenAction,
} from "@/app/(app)/settings/developer-actions";

type Token = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
};

export function TokensClient({
  tokens,
  appUrl,
}: {
  tokens: Token[];
  appUrl: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["products:read", "products:write"]);
  const [newToken, setNewToken] = useState<string | null>(null);

  const sampleToken = newToken ?? "dk_live_YOUR_TOKEN";

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
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
                  <td className="px-4 py-2 font-mono text-xs text-muted">{t.prefix}...</td>
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

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold">
        <span className="text-accent">{"{}"}</span>
        Public REST API (Distru-compatible)
      </h2>
      <p className="mb-2 text-sm text-muted">List products (Bearer auth, page[number] pagination, string-numbers):</p>
      <CodeBlock code={`curl -H "Authorization: Bearer ${sampleToken}" \\\n  ${appUrl}/public/v1/products`} />
      <p className="mb-2 mt-4 text-sm text-muted">Sparse upsert a product (omit id to create, include to update):</p>
      <CodeBlock
        code={`curl -X POST ${appUrl}/public/v1/products \\\n  -H "Authorization: Bearer ${sampleToken}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Gelato 3.5g","sku":"FL-GEL-35","category":"Flower","vendor":"Sungrown Farms","unit_type":"Gram","unit_price":34}'`}
      />
      <p className="mb-2 mt-4 text-sm text-muted">Bulk upload (chunk, validate, partial upload, error CSV):</p>
      <CodeBlock code={`curl -X POST ${appUrl}/api/upload-products \\\n  -H "Authorization: Bearer ${sampleToken}" \\\n  -F file=@catalog.csv`} />

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold">
        <span className="text-accent">◇</span>
        MCP server (drive Distru from your own agent)
      </h2>
      <p className="mb-2 text-sm text-muted">Add to any MCP client (Claude Code, Claude Desktop, Cursor):</p>
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
    </>
  );
}
