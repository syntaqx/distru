import {
  authenticate,
  distruError,
  dateRange,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  createInvoiceForOrder,
  getInvoice,
  invoiceToApi,
  listInvoices,
  recordPayment,
  type InvoiceStatus,
} from "@/lib/modules/sales";
import { getOrderByNumber } from "@/lib/modules/sales";
import { emitEvent } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "invoices:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const offset = pageOffset(req);
  const updated = dateRange(req, "updated_datetime");
  const status = (url.searchParams.get("status") as InvoiceStatus | null) ?? undefined;
  const { items, total } = await listInvoices(auth.ctx, {
    status,
    search: url.searchParams.get("search") ?? undefined,
    updatedFrom: updated.from,
    updatedTo: updated.to,
    limit: PAGE_SIZE,
    offset,
  });
  const full = await Promise.all(items.map((i) => getInvoice(auth.ctx, i.invoice.id)));
  return listEnvelope(req, full.filter((i) => i != null).map((i) => invoiceToApi(i!)), offset, total);
}

type InvoiceBody = {
  order_id?: string;
  order_number?: string;
  due_date?: string;
  payment?: { amount: number; method?: string };
};

/** Create an invoice for an order, optionally recording an initial payment. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "invoices:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as InvoiceBody | null;
  if (!body || (!body.order_id && !body.order_number))
    return distruError(400, "order_id or order_number is required", ["order_id"], "body");

  let orderId = body.order_id;
  if (!orderId && body.order_number) {
    const order = await getOrderByNumber(auth.ctx, body.order_number);
    if (!order) return distruError(404, `Unknown order ${body.order_number}`, ["order_number"], "body");
    orderId = order.order.id;
  }

  try {
    let invoice = await createInvoiceForOrder(auth.ctx, orderId!, {
      dueDate: body.due_date ? new Date(body.due_date) : undefined,
    });
    if (body.payment && body.payment.amount > 0) {
      invoice = await recordPayment(auth.ctx, invoice.invoice.id, {
        amount: body.payment.amount,
        method: body.payment.method,
      });
    }
    const api = invoiceToApi(invoice);
    await emitEvent(auth.ctx, "invoice.created", api, { id: invoice.invoice.id });
    return Response.json({ data: api }, { status: 201 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Invoice creation failed", [], "body");
  }
}
