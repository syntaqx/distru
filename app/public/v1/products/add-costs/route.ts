import { authenticate, requireScope } from "@/lib/public-api";

// POST /public/v1/products/add-costs - attach cost entries to products.
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  // accepted; full product-cost processing deferred in this clone
  return Response.json({ data: { accepted: true, ...(body ?? {}) } });
}
