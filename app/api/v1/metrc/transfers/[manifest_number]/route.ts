import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getMetrcProvider } from "@/lib/integrations";

export async function GET(req: Request, { params }: { params: Promise<{ manifest_number: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const { manifest_number } = await params;
  const transfer = await getMetrcProvider().getTransfer(auth.ctx, decodeURIComponent(manifest_number));
  if (!transfer) return distruError(404, "Metrc transfer not found", ["manifest_number"], "path");
  return Response.json({ data: transfer });
}
