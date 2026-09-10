import { NextResponse } from "next/server";
import { requireOrgContext } from "@/lib/session";
import { configureProvider, getConnection, isProviderKey } from "@/lib/modules/platform";
import { exchangeCode, isOAuthProvider } from "@/lib/integrations/oauth";
import { env } from "@/lib/env";

/**
 * Step 2 of the OAuth connect flow: the vendor redirects back here with an auth
 * code. We verify the CSRF state, exchange the code for access + refresh tokens,
 * store them on the connection (QuickBooks also returns a realm id here), and
 * bounce back to the Integrations screen. Live syncs then use + refresh the token.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const settings = new URL("/settings/integrations", env.appUrl);
  if (!isProviderKey(provider) || !isOAuthProvider(provider)) {
    settings.searchParams.set("error", "Not an OAuth provider");
    return NextResponse.redirect(settings);
  }
  const ctx = await requireOrgContext();
  const svc = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const config = (await getConnection(svc, provider))?.config ?? {};

  if (!code || !state || state !== config.__oauthState) {
    settings.searchParams.set("error", "OAuth state mismatch - please try connecting again");
    return NextResponse.redirect(settings);
  }
  try {
    const tokens = await exchangeCode(provider, config, code);
    const realmId = url.searchParams.get("realmId"); // QuickBooks returns this
    await configureProvider(svc, provider, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? "",
      tokenExpiresAt: tokens.expiresAt,
      __oauthState: "",
      ...(realmId ? { realmId } : {}),
    });
    settings.searchParams.set("connected", provider);
  } catch (err) {
    settings.searchParams.set("error", err instanceof Error ? err.message : "OAuth exchange failed");
  }
  return NextResponse.redirect(settings);
}
