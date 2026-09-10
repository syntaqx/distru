import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getInvoice } from "@/lib/modules/sales";
import { simplePdf, pdfResponse } from "@/lib/pdf";
import { testResultLines, testResultsForProducts } from "@/lib/pdf-test-result";

/** GET /api/v1/invoices/{id}/test-results/pdf — COAs for the invoice's products. */
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

  const items = inv.order?.items ?? [];
  const productIds = new Set(
    items.map((i) => i.productId).filter((p): p is string => Boolean(p)),
  );
  const results = await testResultsForProducts(auth.ctx, productIds);
  if (results.length === 0) {
    return pdfResponse(
      simplePdf("Test Result", [
        `Invoice: ${inv.invoice.invoiceNumber}`,
        "No test results on file.",
      ]),
      `invoice-${inv.invoice.invoiceNumber}-test-results`,
    );
  }

  const lines: string[] = [];
  results.forEach((row, idx) => {
    if (idx > 0) lines.push("");
    lines.push(...testResultLines(row));
  });
  return pdfResponse(
    simplePdf(`Invoice ${inv.invoice.invoiceNumber} Test Results`, lines),
    `invoice-${inv.invoice.invoiceNumber}-test-results`,
  );
}
