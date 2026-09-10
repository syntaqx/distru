import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getTestResult, testResultToApi } from "@/lib/modules/compliance";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getTestResult(auth.ctx, id);
  if (!row) return distruError(404, "Test result not found", ["id"], "path");
  return Response.json({ data: testResultToApi(row) });
}
