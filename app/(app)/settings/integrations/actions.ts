"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import {
  connectProvider,
  disconnectProvider,
  isProviderKey,
  runMockSync,
  type ProviderKey,
} from "@/lib/modules/platform";

function svc(ctx: { orgId: string; actor: string }) {
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
}

function assertProvider(provider: string): ProviderKey {
  if (!isProviderKey(provider)) throw new Error(`Unknown provider: ${provider}`);
  return provider;
}

export async function connectProviderAction(provider: string) {
  const ctx = await requireOrgContext();
  await connectProvider(svc(ctx), assertProvider(provider));
  revalidatePath("/settings/integrations");
}

export async function disconnectProviderAction(provider: string) {
  const ctx = await requireOrgContext();
  await disconnectProvider(svc(ctx), assertProvider(provider));
  revalidatePath("/settings/integrations");
}

export async function syncProviderAction(provider: string) {
  const ctx = await requireOrgContext();
  const result = await runMockSync(svc(ctx), assertProvider(provider));
  revalidatePath("/settings/integrations");
  return { summary: result.summary, count: result.events.length };
}
