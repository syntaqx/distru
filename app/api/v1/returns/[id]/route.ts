import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getReturn, returnToApi } from "@/lib/modules/sales";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "returns:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const ret = await getReturn(auth.ctx, id);
  if (!ret) return distruError(404, "Return not found", ["id"], "path");
  return Response.json({ data: returnToApi(ret) });
}
