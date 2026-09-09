import { authenticate, distruError, listEnvelope, PAGE_SIZE, pageOffset, requireScope } from "@/lib/public-api";
import { listCredits, upsertCredit, creditToApi } from "@/lib/modules/sales";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listCredits(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(creditToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as (Record<string, unknown> | null);
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  if (!body.id && typeof body.amount !== "number") return distruError(400, "amount is required", ["amount"], "body");
  try {
    const { row, created } = await upsertCredit(auth.ctx, {
      id: body.id as string | undefined,
      customerId: body.customer_id as string | null | undefined,
      amount: body.amount as number | undefined,
      remaining: body.remaining as number | undefined,
      reason: body.reason as string | null | undefined,
    });
    return Response.json({ data: creditToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
