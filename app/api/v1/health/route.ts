/**
 * Liveness probe. Intentionally undocumented in the OpenAPI spec - it's an
 * operational endpoint, not part of the API contract - so it's listed in
 * OPENAPI_IGNORE (lib/openapi.ts) and the self-documentation guard skips it.
 */
export function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
