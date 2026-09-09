import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getPaymentMethod, paymentMethodToApi } from "@/lib/modules/sales";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getPaymentMethod(auth.ctx, id);
  if (!row) return distruError(404, "Payment method not found", ["id"], "path");
  return Response.json({ data: paymentMethodToApi(row) });
}
