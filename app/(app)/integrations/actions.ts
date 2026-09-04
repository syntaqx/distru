"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import { createToken, revokeToken } from "@/lib/services/tokens";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
} from "@/lib/services/webhooks";

function svc(ctx: { orgId: string; actor: string }) {
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
}

export async function createTokenAction(name: string, scopes: string[]) {
  const ctx = await requireOrgContext();
  const { token, record } = await createToken(svc(ctx), {
    name: name || "API token",
    scopes,
    createdBy: ctx.userId,
  });
  revalidatePath("/integrations");
  return { token, prefix: record.tokenPrefix };
}

export async function revokeTokenAction(id: string) {
  const ctx = await requireOrgContext();
  await revokeToken(svc(ctx), id);
  revalidatePath("/integrations");
}

export async function createWebhookAction(url: string, events: string[]) {
  const ctx = await requireOrgContext();
  const endpoint = await createWebhookEndpoint(svc(ctx), { url, events });
  revalidatePath("/integrations");
  return { id: endpoint.id, secret: endpoint.secret };
}

export async function deleteWebhookAction(id: string) {
  const ctx = await requireOrgContext();
  await deleteWebhookEndpoint(svc(ctx), id);
  revalidatePath("/integrations");
}
