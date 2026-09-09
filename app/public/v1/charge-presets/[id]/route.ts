import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getChargePreset, chargePresetToApi } from "@/lib/modules/sales";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getChargePreset(auth.ctx, id);
  if (!row) return distruError(404, "Charge preset not found", ["id"], "path");
  return Response.json({ data: chargePresetToApi(row) });
}
