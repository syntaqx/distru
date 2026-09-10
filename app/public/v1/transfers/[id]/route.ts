import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getTransfer, transferToApi } from "@/lib/modules/inventory";

/** GET /public/v1/transfers/{id} — a stock transfer with its lines. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const transfer = await getTransfer(auth.ctx, id);
  if (!transfer) return distruError(404, "Transfer not found", ["id"], "path");
  return Response.json({ data: await transferToApi(auth.ctx, transfer) });
}
