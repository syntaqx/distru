import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { listUnitTypes } from "@/lib/modules/catalog";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const unitType = (await listUnitTypes()).find((u) => u.id === id);
  if (!unitType) return distruError(404, "Unit type not found", ["id"], "path");
  return Response.json({ data: { id: unitType.id, name: unitType.name } });
}
