import { authenticate, requireScope } from "@/lib/public-api";
import { emptyReport } from "../_report";

/** Plant lifecycle stage transitions. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:read");
  if (scopeErr) return scopeErr;

  // no cultivation data in this clone
  return Response.json(emptyReport());
}
