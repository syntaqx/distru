import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getHarvest, harvestToApi } from "@/lib/modules/cultivation";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getHarvest(auth.ctx, id);
  if (!row) return distruError(404, "Harvest not found", ["id"], "path");
  return Response.json({ data: harvestToApi(row) });
}
