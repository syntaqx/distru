import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getInvoice, listPayments, paymentToApi, recordPayment } from "@/lib/modules/sales";

// GET /api/v1/invoices/{id}/payments - list payments recorded on an invoice.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const inv = await getInvoice(auth.ctx, id);
  if (!inv) return distruError(404, "Invoice not found", ["id"], "path");
  const { items } = await listPayments(auth.ctx, { invoiceId: id });
  return Response.json({ data: items.map(paymentToApi) });
}

// POST /api/v1/invoices/{id}/payments - record a payment against an invoice.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:write");
  if (scopeErr) return scopeErr;
  const { id } = await params;

  const inv = await getInvoice(auth.ctx, id);
  if (!inv) return distruError(404, "Invoice not found", ["id"], "path");

  const body = (await req.json().catch(() => null)) as
    | { amount?: unknown; method?: unknown; reference?: unknown }
    | null;
  if (!body || typeof body !== "object") {
    return distruError(422, "A JSON request body is required", [], "body");
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return distruError(422, "amount must be a positive number", ["amount"], "body");
  }
  const method = typeof body.method === "string" ? body.method : undefined;
  const reference = typeof body.reference === "string" ? body.reference : undefined;

  try {
    const updated = await recordPayment(auth.ctx, id, { amount, method, reference });
    const created = updated.payments[0];
    return Response.json({
      data: paymentToApi({ payment: created, invoiceNumber: updated.invoice.invoiceNumber }),
    });
  } catch (err) {
    return distruError(
      422,
      err instanceof Error ? err.message : "Unable to record payment",
      ["amount"],
      "body",
    );
  }
}
