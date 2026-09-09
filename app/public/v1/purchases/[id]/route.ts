import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getPurchaseOrder, purchaseOrderToApi } from "@/lib/modules/purchasing";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "purchase_orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const po = await getPurchaseOrder(auth.ctx, id);
  if (!po) return distruError(404, "Purchase order not found", ["id"], "path");
  return Response.json({ data: purchaseOrderToApi(po) });
}
