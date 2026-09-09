import { authenticate, requireScope } from "@/lib/public-api";

// POST /public/v1/assemblies/split_package - split a package into a new one.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // accepted; full package-split processing deferred in this clone
  return Response.json({ data: { accepted: true, ...(body ?? {}) } });
}
