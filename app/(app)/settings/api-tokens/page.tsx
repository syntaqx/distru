import { getOrgContext } from "@/lib/session";
import { listTokens } from "@/lib/modules/platform";
import { env } from "@/lib/env";
import { TokensClient } from "./tokens-client";

export const dynamic = "force-dynamic";

export default async function ApiTokensPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const tokens = await listTokens(service);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">API tokens</h1>
          <p className="text-sm text-muted">
            Bearer tokens for the public REST API and the MCP server. Tokens are stored hashed; the full value is shown once at creation.
          </p>
        </header>
        <TokensClient
          tokens={tokens.map((t) => ({
            id: t.id,
            name: t.name,
            prefix: t.tokenPrefix,
            scopes: t.scopes,
            lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
          }))}
          appUrl={env.appUrl}
        />
      </div>
    </div>
  );
}
