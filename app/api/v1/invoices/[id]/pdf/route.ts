import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getInvoice } from "@/lib/modules/sales";
import { simplePdf, pdfResponse } from "@/lib/pdf";

/** GET /api/v1/invoices/{id}/pdf — a printable invoice summary as a PDF. */
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

  const r = inv.invoice;
  const total = Number(r.total);
  const paid = Number(r.amountPaid);
  const remaining = total - paid - Number(r.creditsApplied);
  const lines = [
    `Company: ${inv.customer?.name ?? "-"}`,
    `Status: ${r.status}`,
    "",
    `Total: $${total.toFixed(2)}`,
    `Paid: $${paid.toFixed(2)}`,
    `Remaining: $${remaining.toFixed(2)}`,
  ];
  return pdfResponse(
    simplePdf(`Invoice ${r.invoiceNumber}`, lines),
    `invoice-${r.invoiceNumber}`,
  );
}
