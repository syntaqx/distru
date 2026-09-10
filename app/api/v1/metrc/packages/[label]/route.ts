import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getMetrcProvider } from "@/lib/integrations";

export async function GET(req: Request, { params }: { params: Promise<{ label: string }> }) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const { label } = await params;
  const pkg = await getMetrcProvider().getPackage(auth.ctx, decodeURIComponent(label));
  if (!pkg) return distruError(404, "Metrc package not found", ["label"], "path");
  return Response.json({ data: pkg });
}
