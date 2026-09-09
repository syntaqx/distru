import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getVehicle, vehicleToApi } from "@/lib/modules/logistics";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const vehicle = await getVehicle(auth.ctx, id);
  if (!vehicle) return distruError(404, "Vehicle not found", ["id"], "path");
  return Response.json({ data: vehicleToApi(vehicle) });
}
