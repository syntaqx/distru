import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getPaymentTerm, paymentTermToApi } from "@/lib/modules/sales";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getPaymentTerm(auth.ctx, id);
  if (!row) return distruError(404, "Payment term not found", ["id"], "path");
  return Response.json({ data: paymentTermToApi(row) });
}
