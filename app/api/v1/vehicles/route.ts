import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listVehicles, upsertVehicle, vehicleToApi } from "@/lib/modules/logistics";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listVehicles(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(vehicleToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.name) return distruError(400, "name is required", ["name"], "body");
  try {
    const { row, created } = await upsertVehicle(auth.ctx, {
      id: body.id as string | undefined,
      name: body.name as string | undefined,
      make: (body.make as string) ?? null,
      model: (body.model as string) ?? null,
      licensePlate: (body.license_plate as string) ?? null,
    });
    return Response.json({ data: vehicleToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
