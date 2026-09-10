import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getCostType, costTypeToApi } from "@/lib/modules/manufacturing";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getCostType(auth.ctx, id);
  if (!row) return distruError(404, "Cost type not found", ["id"], "path");
  return Response.json({ data: costTypeToApi(row) });
}
