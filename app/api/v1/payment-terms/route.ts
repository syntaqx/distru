import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listPaymentTerms, upsertPaymentTerm, paymentTermToApi } from "@/lib/modules/sales";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listPaymentTerms(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(paymentTermToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> | null);
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && !body.name) return distruError(400, "name is required", ["name"], "body");
  try {
    const { row, created } = await upsertPaymentTerm(auth.ctx, {
      id: body.id as string | undefined,
      name: body.name as string | undefined,
      netDays: body.net_days as number | undefined,
    });
    return Response.json({ data: paymentTermToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
