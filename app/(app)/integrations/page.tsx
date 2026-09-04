import { getOrgContext } from "@/lib/session";
import { listTokens } from "@/lib/services/tokens";
import { listWebhookEndpoints, recentDeliveries } from "@/lib/services/webhooks";
import { env } from "@/lib/env";
import { IntegrationsClient } from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [tokens, endpoints, deliveries] = await Promise.all([
    listTokens(service),
    listWebhookEndpoints(service),
    recentDeliveries(service),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-[var(--color-muted)]">
          The same catalog, five ways: the Copilot, the public REST API, the MCP server, the
          bulk uploader, and signed webhooks.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <IntegrationsClient
          tokens={tokens.map((t) => ({
            id: t.id,
            name: t.name,
            prefix: t.tokenPrefix,
            scopes: t.scopes,
            lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
          }))}
          endpoints={endpoints.map((e) => ({
            id: e.id,
            url: e.url,
            events: e.events,
            active: e.active,
          }))}
          deliveries={deliveries.map((d) => ({
            id: d.id,
            eventType: d.eventType,
            status: d.status,
            responseStatus: d.responseStatus,
            createdAt: d.createdAt.toISOString(),
          }))}
          appUrl={env.appUrl}
        />
      </div>
    </div>
  );
}
