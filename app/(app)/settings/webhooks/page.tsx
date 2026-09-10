import { getOrgContext } from "@/lib/session";
import { listWebhookEndpoints, recentDeliveries } from "@/lib/modules/platform";
import { WebhooksClient } from "./webhooks-client";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const [endpoints, deliveries] = await Promise.all([
    listWebhookEndpoints(service),
    recentDeliveries(service),
  ]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">Webhooks</h1>
          <p className="text-sm text-muted">
            Receive HMAC-signed events when records change. Deliveries are retried with exponential backoff if your endpoint is unavailable.
          </p>
        </header>
        <WebhooksClient
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
        />
      </div>
    </div>
  );
}
