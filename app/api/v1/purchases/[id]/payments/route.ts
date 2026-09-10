import { authenticate, distruError, requireScope } from "@/lib/public-api";

// GET/POST /api/v1/purchases/{id}/payments - payments against a purchase order.
//
// The purchasing module tracks receiving and status but exposes no payment
// function, so we return an honest 422 rather than faking a payment ledger.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  await params;
  return distruError(422, "Purchase order payments are not supported in this build", ["id"], "path");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;
  await params;
  return distruError(422, "Purchase order payments are not supported in this build", ["id"], "path");
}
