import { authenticate, requireScope } from "@/lib/public-api";

// POST /api/v1/credits/{id}/cancel - cancel a credit.
//
// The sales module exposes no `cancelCredit` function, so we accept and echo
// rather than fabricating a cancellation.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // accepted; full credit-cancellation processing deferred in this clone
  return Response.json({ data: { accepted: true, id, ...(body ?? {}) } });
}
