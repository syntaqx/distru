import { authenticate, requireScope } from "@/lib/public-api";
import { getBatch } from "@/lib/modules/inventory";
import { simplePdf, pdfResponse } from "@/lib/pdf";
import { testResultLines, testResultsForProducts } from "@/lib/pdf-test-result";

/** GET /api/v1/batches/{id}/primary-test-result/pdf — the batch's COA. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;

  const batch = await getBatch(auth.ctx, id);
  const productId = batch?.productId ?? null;
  const results = productId
    ? await testResultsForProducts(auth.ctx, new Set([productId]))
    : [];
  if (results.length === 0) {
    return pdfResponse(
      simplePdf("Test Result", [
        `Batch: ${batch?.batchNumber ?? id}`,
        "No test result on file.",
      ]),
      `batch-${id}-test-result`,
    );
  }
  return pdfResponse(
    simplePdf("Test Result", testResultLines(results[0])),
    `batch-${id}-test-result`,
  );
}
