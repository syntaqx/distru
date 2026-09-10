import {
  authenticate,
  distruError,
  listEnvelope,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  createTransfer,
  listTransfers,
  transferToApi,
  getTransfer,
  InsufficientStockError,
} from "@/lib/modules/inventory";

/** GET /api/v1/transfers — list stock transfers between locations. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listTransfers(auth.ctx, { offset });
  const data = await Promise.all(
    items.map(async (t) => transferToApi(auth.ctx, (await getTransfer(auth.ctx, t.id))!)),
  );
  return listEnvelope(req, data, offset, total);
}

type Body = {
  from_location_id?: string;
  to_location_id?: string;
  notes?: string | null;
  lines?: { product_id: string; quantity: number | string }[];
};

/** POST /api/v1/transfers — create and execute a stock transfer. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.from_location_id || !body?.to_location_id)
    return distruError(400, "from_location_id and to_location_id are required", ["from_location_id"], "body");
  if (!body.lines?.length)
    return distruError(400, "at least one line is required", ["lines"], "body");

  try {
    const transfer = await createTransfer(auth.ctx, {
      fromLocationId: body.from_location_id,
      toLocationId: body.to_location_id,
      notes: body.notes ?? null,
      lines: body.lines.map((l) => ({ productId: l.product_id, quantity: l.quantity })),
    });
    return Response.json({ data: await transferToApi(auth.ctx, transfer) }, { status: 201 });
  } catch (err) {
    if (err instanceof InsufficientStockError)
      return distruError(422, err.message, ["lines"], "body");
    if (err instanceof Error) return distruError(400, err.message, ["lines"], "body");
    throw err;
  }
}
