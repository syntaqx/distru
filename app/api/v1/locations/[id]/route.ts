import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { listLocations } from "@/lib/modules/catalog";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const location = (await listLocations(auth.ctx)).find((l) => l.id === id);
  if (!location) return distruError(404, "Location not found", ["id"], "path");
  return Response.json({ data: { id: location.id, name: location.name } });
}
