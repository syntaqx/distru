import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/services/tokens";
import type { ServiceCtx } from "@/lib/services/context";

/**
 * Helpers that make our public API byte-for-convention compatible with Distru's
 * real one: Bearer tokens, `{ errors: [{ message, pointer }] }`, `data` +
 * `next_page` envelopes, and `page[number]` pagination.
 */

export type ApiAuth = { ctx: ServiceCtx; scopes: string[] };

export async function authenticate(
  req: Request,
): Promise<ApiAuth | NextResponse> {
  const token = await verifyBearerToken(req.headers.get("authorization"));
  if (!token) {
    return distruError(401, "Missing or invalid API token", ["authorization"]);
  }
  return {
    ctx: {
      orgId: token.orgId,
      actor: `api:${token.tokenId}`,
      actorType: "api",
    },
    scopes: token.scopes,
  };
}

export function requireScope(auth: ApiAuth, scope: string): NextResponse | null {
  if (auth.scopes.includes(scope) || auth.scopes.includes("*")) return null;
  return distruError(403, `Missing required scope: ${scope}`);
}

export function distruError(
  status: number,
  message: string,
  pointer?: string[],
) {
  return NextResponse.json(
    { errors: [{ message, pointer: pointer ?? [] }] },
    { status },
  );
}

export const PAGE_SIZE = 50;

export function pageNumber(req: Request): number {
  const url = new URL(req.url);
  const raw = url.searchParams.get("page[number]") ?? url.searchParams.get("page");
  const n = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function listEnvelope<T>(
  req: Request,
  data: T[],
  page: number,
  total: number,
) {
  const hasNext = page * PAGE_SIZE < total;
  let nextPage: string | null = null;
  if (hasNext) {
    const url = new URL(req.url);
    url.searchParams.set("page[number]", String(page + 1));
    nextPage = url.toString();
  }
  return NextResponse.json({ data, next_page: nextPage, total });
}
