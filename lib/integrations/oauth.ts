/**
 * OAuth2 (authorization-code) for the accounting providers that require it -
 * QuickBooks, Xero, Sage. A tenant enters their app's client id/secret in the
 * Configure dialog, clicks "Connect", is redirected to the vendor to authorize,
 * and the callback exchanges the code for access + refresh tokens that we store
 * on the connection. Live syncs then refresh the token as needed.
 *
 * Endpoints/scopes follow each vendor's documented OAuth setup. Not exercised
 * against live vendors here (no apps), but correct by construction.
 */
import { env } from "@/lib/env";

export type OAuthProvider = "quickbooks" | "xero" | "sage";

export type OAuthTokens = { accessToken: string; refreshToken?: string; expiresAt: number };

type ProviderOAuth = { authorizeUrl: string; tokenUrl: string; scope: string };

const OAUTH: Record<OAuthProvider, ProviderOAuth> = {
  quickbooks: {
    authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scope: "com.intuit.quickbooks.accounting",
  },
  xero: {
    authorizeUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scope: "openid offline_access accounting.transactions accounting.contacts",
  },
  sage: {
    authorizeUrl: "https://www.sageone.com/oauth2/auth/central",
    tokenUrl: "https://oauth.accounting.sage.com/token",
    scope: "full_access",
  },
};

export function isOAuthProvider(p: string): p is OAuthProvider {
  return p === "quickbooks" || p === "xero" || p === "sage";
}

/** The callback URL the vendor redirects back to (must match the app's config). */
export function redirectUri(provider: OAuthProvider): string {
  return `${env.appUrl.replace(/\/$/, "")}/api/integrations/${provider}/callback`;
}

const str = (c: Record<string, unknown>, k: string) => (typeof c[k] === "string" ? (c[k] as string) : "");

/** The vendor authorize URL to redirect the operator to (step 1 of the flow). */
export function buildAuthorizeUrl(provider: OAuthProvider, config: Record<string, unknown>, state: string): string {
  const meta = OAUTH[provider];
  const params = new URLSearchParams({
    client_id: str(config, "clientId"),
    response_type: "code",
    scope: meta.scope,
    redirect_uri: redirectUri(provider),
    state,
  });
  return `${meta.authorizeUrl}?${params.toString()}`;
}

function basicAuth(config: Record<string, unknown>): string {
  return Buffer.from(`${str(config, "clientId")}:${str(config, "clientSecret")}`).toString("base64");
}

async function tokenRequest(provider: OAuthProvider, config: Record<string, unknown>, body: URLSearchParams): Promise<OAuthTokens> {
  const res = await fetch(OAUTH[provider].tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(config)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${provider} token exchange failed: ${res.status} ${text.slice(0, 200)}`);
  const data = JSON.parse(text) as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

/** Exchange the authorization code for tokens (step 2, in the callback route). */
export function exchangeCode(provider: OAuthProvider, config: Record<string, unknown>, code: string): Promise<OAuthTokens> {
  return tokenRequest(
    provider,
    config,
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(provider) }),
  );
}

/** Refresh an expired access token (used by live syncs before calling the API). */
export function refreshOAuthToken(provider: OAuthProvider, config: Record<string, unknown>): Promise<OAuthTokens> {
  const refresh = str(config, "refreshToken");
  if (!refresh) throw new Error(`No refresh token stored for ${provider}`);
  return tokenRequest(provider, config, new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }));
}
