import { authenticate, requireScope } from "@/lib/public-api";
import { getPackage } from "@/lib/modules/inventory";
import { simplePdf, pdfResponse } from "@/lib/pdf";
import { testResultLines, testResultsForProducts } from "@/lib/pdf-test-result";

/** GET /api/v1/packages/{id}/primary-test-result/pdf — the package's COA. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;

  const pkg = await getPackage(auth.ctx, id);
  const productId = pkg?.productId ?? null;
  const results = productId
    ? await testResultsForProducts(auth.ctx, new Set([productId]))
    : [];
  if (results.length === 0) {
    return pdfResponse(
      simplePdf("Test Result", [
        `Package: ${pkg?.packageTag ?? id}`,
        "No test result on file.",
      ]),
      `package-${id}-test-result`,
    );
  }
  return pdfResponse(
    simplePdf("Test Result", testResultLines(results[0])),
    `package-${id}-test-result`,
  );
}
