import { authenticate, dateRange, requireScope } from "@/lib/public-api";
import { getReportDef, reportEnvelope, runReport } from "@/lib/modules/reports";

/**
 * Build a public `/reports/<name>` route handler from a registry definition.
 * Every report endpoint is now this one function: authenticate, check the
 * report's scope, parse its status + date-range params, run it, envelope it.
 * The report's logic lives once in the registry (`lib/modules/reports`).
 */
export function reportRoute(name: string) {
  return async function GET(req: Request) {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const def = getReportDef(name);
    if (!def) return Response.json({ error: "unknown report" }, { status: 404 });
    const scopeErr = requireScope(auth, def.scope);
    if (scopeErr) return scopeErr;

    const status = def.hasStatus
      ? new URL(req.url).searchParams.get("status") ?? undefined
      : undefined;
    const range = def.dateField ? dateRange(req, def.dateField) : {};
    const result = await runReport(auth.ctx, name, { status, from: range.from, to: range.to });
    return Response.json(reportEnvelope(result!.columns, result!.rows));
  };
}
