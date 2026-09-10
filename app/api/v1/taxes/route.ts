import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listTaxes, upsertTax, taxToApi } from "@/lib/modules/catalog";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listTaxes(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(taxToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.name) return distruError(400, "name is required", ["name"], "body");
  try {
    const { row, created } = await upsertTax(auth.ctx, {
      id: body.id as string | undefined,
      name: body.name as string | undefined,
      rate: body.rate as string | number | undefined,
    });
    return Response.json({ data: taxToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
