import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getOrder } from "@/lib/modules/sales";
import { simplePdf, pdfResponse } from "@/lib/pdf";
import { testResultLines, testResultsForProducts } from "@/lib/pdf-test-result";

/** GET /public/v1/orders/{id}/test-results/pdf — COAs for the order's products. */
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

  const productIds = new Set(
    o.items.map((i) => i.productId).filter((p): p is string => Boolean(p)),
  );
  const results = await testResultsForProducts(auth.ctx, productIds);
  if (results.length === 0) {
    return pdfResponse(
      simplePdf("Test Result", [
        `Order: ${o.order.orderNumber}`,
        "No test results on file.",
      ]),
      `order-${o.order.orderNumber}-test-results`,
    );
  }

  const lines: string[] = [];
  results.forEach((row, idx) => {
    if (idx > 0) lines.push("");
    lines.push(...testResultLines(row));
  });
  return pdfResponse(
    simplePdf(`Order ${o.order.orderNumber} Test Results`, lines),
    `order-${o.order.orderNumber}-test-results`,
  );
}
