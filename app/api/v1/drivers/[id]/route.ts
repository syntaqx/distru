import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getDriver, driverToApi } from "@/lib/modules/logistics";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const driver = await getDriver(auth.ctx, id);
  if (!driver) return distruError(404, "Driver not found", ["id"], "path");
  return Response.json({ data: driverToApi(driver) });
}
