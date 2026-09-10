import { authenticate, requireScope } from "@/lib/public-api";
import { fleetTelemetryToApi, getFleetTelemetry } from "@/lib/modules/logistics";

/**
 * GET /public/v1/fleet/telemetry
 *
 * The live fleet snapshot behind the Dispatch board: every vehicle's last-known
 * position, speed, heading, and movement status, its driver, the delivery it's
 * currently running (with destination coords + an ETA), and per-vehicle +
 * fleet-wide stop counts for today. Read-only; not paginated (a fleet is small).
 */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:read");
  if (scopeErr) return scopeErr;
  const snapshot = await getFleetTelemetry(auth.ctx);
  return Response.json({ data: fleetTelemetryToApi(snapshot) });
}
