import { authenticate, requireScope } from "@/lib/public-api";

// POST /public/v1/assemblies/create_test_sample - create a test sample package.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // accepted; full test-sample processing deferred in this clone
  return Response.json({ data: { accepted: true, ...(body ?? {}) } });
}
