import { authenticate, distruError, requireScope } from "@/lib/public-api";

type Body = {
  product_id?: string;
  pos_product_id?: string;
};

/** POS mappings are not modeled in this clone. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;

  return Response.json({ data: [], next_page: null, total: 0 });
}

/** POS mappings are not modeled in this clone. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.product_id)
    return distruError(400, "product_id is required", ["product_id"], "body");

  return Response.json({ data: { accepted: true } });
}
