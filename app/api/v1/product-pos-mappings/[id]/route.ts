import { authenticate, distruError, requireScope } from "@/lib/public-api";

/** POS mappings are not modeled in this clone. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;

  await params;
  return distruError(404, "POS mapping not found", ["id"], "path");
}
