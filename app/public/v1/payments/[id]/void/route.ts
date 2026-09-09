import { authenticate, distruError, requireScope } from "@/lib/public-api";

// POST /public/v1/payments/{id}/void - void a recorded payment.
//
// The sales module models payments as an immutable ledger and exposes no
// `voidPayment` function, so we return an honest 422 rather than faking a void.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;
  await params;
  return distruError(422, "Payment voiding is not supported in this build", ["id"], "path");
}
