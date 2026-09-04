import { randomBytes, createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import type { ServiceCtx } from "./context";
import { recordAudit } from "./audit";

export function hashToken(plaintext: string) {
  return createHash("sha256").update(plaintext).digest("hex");
}

export async function listTokens(ctx: ServiceCtx) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      scopes: apiTokens.scopes,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.organizationId, ctx.orgId))
    .orderBy(desc(apiTokens.createdAt));
}

/** Create a token. The plaintext is returned once and never stored. */
export async function createToken(
  ctx: ServiceCtx,
  input: { name: string; scopes?: string[]; createdBy?: string },
) {
  const plaintext = `dk_live_${randomBytes(24).toString("hex")}`;
  const tokenPrefix = plaintext.slice(0, 16);
  const [row] = await db
    .insert(apiTokens)
    .values({
      organizationId: ctx.orgId,
      name: input.name,
      tokenHash: hashToken(plaintext),
      tokenPrefix,
      scopes: input.scopes ?? ["products:read", "products:write"],
      createdBy: input.createdBy ?? null,
    })
    .returning();
  await recordAudit(ctx, {
    action: "api_token.create",
    entityType: "api_token",
    entityId: row.id,
    after: { name: row.name },
  });
  return { token: plaintext, record: row };
}

export async function revokeToken(ctx: ServiceCtx, id: string) {
  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.organizationId, ctx.orgId), eq(apiTokens.id, id)));
  await recordAudit(ctx, {
    action: "api_token.revoke",
    entityType: "api_token",
    entityId: id,
  });
}

export type VerifiedToken = {
  tokenId: string;
  orgId: string;
  scopes: string[];
};

/** Verify a bearer token from the Authorization header. Updates last-used. */
export async function verifyBearerToken(
  authHeader: string | null,
): Promise<VerifiedToken | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const plaintext = match[1].trim();
  const [row] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashToken(plaintext)))
    .limit(1);
  if (!row) return null;
  // best-effort last-used update
  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.id))
    .catch(() => {});
  return { tokenId: row.id, orgId: row.organizationId, scopes: row.scopes };
}
