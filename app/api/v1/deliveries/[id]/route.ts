import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { deliveryToApi, getDeliveryEnriched } from "@/lib/modules/logistics";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const delivery = await getDeliveryEnriched(auth.ctx, id);
  if (!delivery) return distruError(404, "Delivery not found", ["id"], "path");
  return Response.json({ data: deliveryToApi(delivery) });
}
