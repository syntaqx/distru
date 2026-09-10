import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { configureProvider, getConnection, isProviderKey } from "@/lib/modules/platform";
import { buildAuthorizeUrl, isOAuthProvider } from "@/lib/integrations/oauth";
import { env } from "@/lib/env";

/**
 * Step 1 of the OAuth connect flow for an accounting provider (QuickBooks / Xero
 * / Sage): mint a CSRF state, stash it on the connection, and redirect the
 * operator to the vendor's authorize page. The operator must have saved their
 * app's client id/secret first (via Configure).
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProviderKey(provider) || !isOAuthProvider(provider)) {
    return NextResponse.json({ error: "Not an OAuth provider" }, { status: 400 });
  }
  const ctx = await requireOrgContext();
  const svc = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const config = (await getConnection(svc, provider))?.config ?? {};
  const settings = new URL("/settings/integrations", env.appUrl);
  if (!config.clientId || !config.clientSecret) {
    settings.searchParams.set("error", "Enter the OAuth client id and secret first");
    return NextResponse.redirect(settings);
  }
  const state = randomBytes(16).toString("hex");
  await configureProvider(svc, provider, { __oauthState: state });
  return NextResponse.redirect(buildAuthorizeUrl(provider, config, state));
}
