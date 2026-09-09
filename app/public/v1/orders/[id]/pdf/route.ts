import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getOrder } from "@/lib/modules/sales";
import { simplePdf, pdfResponse } from "@/lib/pdf";

/** GET /public/v1/orders/{id}/pdf — a printable order summary as a PDF. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const o = await getOrder(auth.ctx, id);
  if (!o) return distruError(404, "Order not found", ["id"], "path");

  const r = o.order;
  const date = r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : "-";
  const lines = [
    `Customer: ${o.customer?.name ?? "-"}`,
    `Status: ${r.status}`,
    `Date: ${date}`,
    "",
    "Items:",
    ...o.items.map(
      (i) => `  ${i.name} x${Number(i.quantity)} @ $${Number(i.unitPrice).toFixed(2)}`,
    ),
    "",
    `Total: $${Number(o.total).toFixed(2)}`,
  ];
  return pdfResponse(simplePdf(`Order ${r.orderNumber}`, lines), `order-${r.orderNumber}`);
}
