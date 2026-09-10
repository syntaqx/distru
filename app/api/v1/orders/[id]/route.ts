import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getOrder, orderToApi } from "@/lib/modules/sales";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const order = await getOrder(auth.ctx, id);
  if (!order) return distruError(404, "Order not found", ["id"], "path");
  return Response.json({ data: orderToApi(order) });
}
