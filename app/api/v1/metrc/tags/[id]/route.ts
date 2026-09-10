import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getMetrcProvider } from "@/lib/integrations";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const tag = await getMetrcProvider().getTag(auth.ctx, decodeURIComponent(id));
  if (!tag) return distruError(404, "Metrc tag not found", ["id"], "path");
  return Response.json({ data: tag });
}
