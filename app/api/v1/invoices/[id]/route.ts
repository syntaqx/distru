import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getInvoice, invoiceToApi } from "@/lib/modules/sales";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "invoices:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const invoice = await getInvoice(auth.ctx, id);
  if (!invoice) return distruError(404, "Invoice not found", ["id"], "path");
  return Response.json({ data: invoiceToApi(invoice) });
}
