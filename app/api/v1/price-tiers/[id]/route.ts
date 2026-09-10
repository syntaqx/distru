import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getPriceTier, priceTierToApi } from "@/lib/modules/sales";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getPriceTier(auth.ctx, id);
  if (!row) return distruError(404, "Price tier not found", ["id"], "path");
  return Response.json({ data: priceTierToApi(row) });
}
