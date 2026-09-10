import { authenticate, requireScope } from "@/lib/public-api";
import { getMetrcProvider } from "@/lib/integrations";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const { data, next_page } = await getMetrcProvider().listStrains(auth.ctx);
  return Response.json({ data, next_page, total: data.length });
}
