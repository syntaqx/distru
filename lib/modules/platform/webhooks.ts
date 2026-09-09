import { createHmac } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema";
import type { ServiceCtx } from "../shared";

export async function listWebhookEndpoints(ctx: ServiceCtx) {
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.organizationId, ctx.orgId))
    .orderBy(desc(webhookEndpoints.createdAt));
}

export async function createWebhookEndpoint(
  ctx: ServiceCtx,
  input: { url: string; events?: string[]; secret?: string },
) {
  const secret = input.secret ?? `whsec_${cryptoRandom()}`;
  const [row] = await db
    .insert(webhookEndpoints)
    .values({
      organizationId: ctx.orgId,
      url: input.url,
      secret,
      events: input.events ?? ["product.created", "product.updated"],
    })
    .returning();
  return row;
}

function cryptoRandom() {
  return createHmac("sha256", String(Math.random()))
    .update(String(Date.now()))
    .digest("hex")
    .slice(0, 32);
}

export async function recentDeliveries(ctx: ServiceCtx, limit = 20) {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.organizationId, ctx.orgId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

/**
 * Emit a domain event to every matching endpoint. Signs the body with
 * HMAC-SHA256 (x-distru-signature: sha256=<hex>), mirroring Distru. Delivery is
 * best-effort and always logged; production would move this to a queue with
 * retry/backoff.
 */
export async function emitEvent(
  ctx: ServiceCtx,
  eventType: string,
  object: Record<string, unknown>,
  meta?: { id?: string; changes?: Record<string, unknown> },
) {
  const endpoints = (await listWebhookEndpoints(ctx)).filter(
    (e) => e.active && e.events.includes(eventType),
  );
  const payload = {
    type: eventType.split(".")[0],
    event: eventType.split(".")[1]?.toUpperCase() ?? "UPDATE",
    id: meta?.id ?? (object.id as string | undefined) ?? null,
    object,
    changes: meta?.changes ?? null,
    occurred_datetime: new Date().toISOString().replace("Z", "000Z"),
  };
  const body = JSON.stringify(payload);

  await Promise.all(
    endpoints.map(async (endpoint) => {
      const signature = createHmac("sha256", endpoint.secret)
        .update(body)
        .digest("hex");
      const [delivery] = await db
        .insert(webhookDeliveries)
        .values({
          organizationId: ctx.orgId,
          endpointId: endpoint.id,
          eventType,
          payload,
          status: "pending",
          attempts: 1,
        })
        .returning();
      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-distru-signature": `sha256=${signature}`,
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        await db
          .update(webhookDeliveries)
          .set({ status: res.ok ? "success" : "failed", responseStatus: res.status })
          .where(eq(webhookDeliveries.id, delivery.id));
      } catch {
        await db
          .update(webhookDeliveries)
          .set({ status: "failed" })
          .where(eq(webhookDeliveries.id, delivery.id));
      }
    }),
  );
}

export async function deleteWebhookEndpoint(ctx: ServiceCtx, id: string) {
  await db
    .delete(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.organizationId, ctx.orgId),
        eq(webhookEndpoints.id, id),
      ),
    );
}
