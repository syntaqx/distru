import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/modules/platform";
import type { ServiceCtx } from "@/lib/modules/shared";

/**
 * Helpers that make our public API byte-for-convention compatible with Distru's
 * real one: Bearer tokens, `{ errors: [{ message, pointer }] }`, `data` +
 * `next_page` envelopes, and opaque `page[after]` cursor pagination.
 */

export type ApiAuth = { ctx: ServiceCtx; scopes: string[] };

export async function authenticate(
  req: Request,
): Promise<ApiAuth | NextResponse> {
  const token = await verifyBearerToken(req.headers.get("authorization"));
  if (!token) {
    return distruError(401, "Missing or invalid API token", ["authorization"], "header");
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

/** Which part of the request an error points at - matches Distru's real API. */
export type ErrorSection = "body" | "query" | "path" | "header";

export function distruError(
  status: number,
  message: string,
  pointer?: (string | number)[],
  section?: ErrorSection,
) {
  // Distru's real error shape is { message, pointer, section }: `pointer` is a
  // path into the offending value (strings for keys, ints for array indices, e.g.
  // ["items", 0, "sku"]) and `section` says which part of the request it lives in
  // (body | query | path | header). Included only when supplied.
  const error: { message: string; pointer: (string | number)[]; section?: ErrorSection } = {
    message,
    pointer: pointer ?? [],
  };
  if (section) error.section = section;
  return NextResponse.json({ errors: [error] }, { status });
}

export const PAGE_SIZE = 50;

/**
 * Distru paginates with `page[number]` plus a followable `next_page` URL. We
 * honor that contract, and additionally accept an OPAQUE `page[after]` seek
 * cursor (a base64 token) which our own `next_page` emits — a client can either
 * follow `next_page` blindly or drive `page[number]` itself. Decoding the cursor
 * yields the row offset to start from.
 */
export function pageOffset(req: Request): number {
  const url = new URL(req.url);
  const after = url.searchParams.get("page[after]");
  if (after) {
    try {
      const decoded = JSON.parse(Buffer.from(after, "base64url").toString());
      if (typeof decoded?.o === "number" && decoded.o >= 0) return decoded.o;
    } catch {
      // fall through to page[number]
    }
  }
  const raw = url.searchParams.get("page[number]") ?? url.searchParams.get("page");
  const n = raw ? parseInt(raw, 10) : 1;
  const page = Number.isFinite(n) && n > 0 ? n : 1;
  return (page - 1) * PAGE_SIZE;
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

/**
 * Parse a Distru-style comma-delimited inclusive datetime range from a query
 * param, e.g. `updated_datetime=2026-01-01T00:00:00Z,` (on/after),
 * `updated_datetime=,2026-02-01T00:00:00Z` (on/before), or both for a between.
 */
export function dateRange(
  req: Request,
  param: string,
): { from?: Date; to?: Date } {
  const raw = new URL(req.url).searchParams.get(param);
  if (!raw) return {};
  const [fromRaw, toRaw] = raw.split(",");
  const parse = (s?: string) => {
    if (!s || !s.trim()) return undefined;
    const d = new Date(s.trim());
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  return { from: parse(fromRaw), to: parse(toRaw) };
}

export function listEnvelope<T>(
  req: Request,
  data: T[],
  offset: number,
  total: number,
) {
  const nextOffset = offset + PAGE_SIZE;
  let nextPage: string | null = null;
  if (nextOffset < total) {
    const url = new URL(req.url);
    url.searchParams.delete("page[number]");
    url.searchParams.delete("page");
    url.searchParams.set("page[after]", encodeCursor(nextOffset));
    nextPage = url.toString();
  }
  return NextResponse.json({ data, next_page: nextPage, total });
}
