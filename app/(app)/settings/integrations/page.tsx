import { getOrgContext } from "@/lib/session";
import { listConnections, listSyncEvents } from "@/lib/modules/platform";
import { IntegrationsClient } from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [connections, events] = await Promise.all([
    listConnections(service),
    listSyncEvents(service, { limit: 40 }),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-muted">
          Connect Distru to the systems you already run on - accounting, state
          track-and-trace, marketplace, and delivery. Connected providers sync
          against your real data; every push and pull shows up in the activity
          feed below.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <IntegrationsClient
          providers={connections.map((c) => ({
            key: c.key,
            label: c.label,
            category: c.category,
            blurb: c.blurb,
            syncVerb: c.syncVerb,
            setupHint: c.setupHint,
            configFields: c.configFields,
            status: c.status,
            configured: c.configured,
            configValues: c.configValues,
            secretsSet: c.secretsSet,
            oauth: c.oauth,
            authorized: c.authorized,
            live: c.live,
            connectedAt: c.connectedAt ? c.connectedAt.toISOString() : null,
            lastSyncedAt: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
          }))}
          events={events.map((e) => ({
            id: e.id,
            provider: e.provider,
            direction: e.direction as "push" | "pull",
            entityType: e.entityType,
            summary: e.summary,
            status: e.status as "success" | "error",
            createdAt: e.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
