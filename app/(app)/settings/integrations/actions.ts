"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import {
  configureProvider,
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

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

/** Save credentials for a provider; auto-connects once all required fields are set. */
export async function configureProviderAction(
  provider: string,
  patch: Record<string, string>,
): Promise<{ ok: boolean; error?: string; configured?: boolean; missing?: string[] }> {
  const ctx = await requireOrgContext();
  try {
    const { configured, missing } = await configureProvider(svc(ctx), assertProvider(provider), patch);
    revalidatePath("/settings/integrations");
    return { ok: true, configured, missing };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function connectProviderAction(
  provider: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireOrgContext();
  try {
    await connectProvider(svc(ctx), assertProvider(provider));
    revalidatePath("/settings/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function disconnectProviderAction(
  provider: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireOrgContext();
  try {
    await disconnectProvider(svc(ctx), assertProvider(provider));
    revalidatePath("/settings/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function syncProviderAction(
  provider: string,
): Promise<{ ok: boolean; error?: string; summary?: string; count?: number }> {
  const ctx = await requireOrgContext();
  try {
    const result = await runMockSync(svc(ctx), assertProvider(provider));
    revalidatePath("/settings/integrations");
    return { ok: true, summary: result.summary, count: result.events.length };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
