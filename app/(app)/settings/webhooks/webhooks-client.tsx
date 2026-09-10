"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { CodeBlock } from "@/components/code-block";
import {
  createWebhookAction,
  deleteWebhookAction,
} from "@/app/(app)/settings/developer-actions";

type Endpoint = { id: string; url: string; events: string[]; active: boolean };
type Delivery = {
  id: string;
  eventType: string;
  status: string;
  responseStatus: number | null;
  createdAt: string;
};

export function WebhooksClient({
  endpoints,
  deliveries,
}: {
  endpoints: Endpoint[];
  deliveries: Delivery[];
}) {
  const [pending, startTransition] = useTransition();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  return (
    <>
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
            <div className="mb-1 text-xs text-muted">Signing secret (verify x-distru-signature: sha256=HMAC):</div>
            <CodeBlock code={newSecret} />
          </div>
        )}
      </div>

      {endpoints.length > 0 && (
        <div className="mt-3 space-y-2">
          {endpoints.map((e) => (
            <div key={e.id} className="flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--color-surface)" }}>
              <span className="badge shrink-0" style={{ color: e.active ? "var(--color-accent)" : "var(--color-muted)" }}>
                {e.active ? "active" : "off"}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{e.url}</span>
              <span className="hidden shrink-0 truncate text-xs text-muted sm:inline">{e.events.join(", ")}</span>
              <button className="btn btn-danger ml-auto shrink-0 px-2 py-1 text-xs" onClick={() => startTransition(() => deleteWebhookAction(e.id))}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {deliveries.length > 0 && (
        <div className="mt-6">
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
    </>
  );
}
