import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getPayment, paymentToApi } from "@/lib/modules/sales";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "invoices:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const payment = await getPayment(auth.ctx, id);
  if (!payment) return distruError(404, "Payment not found", ["id"], "path");
  return Response.json({ data: paymentToApi(payment) });
}
