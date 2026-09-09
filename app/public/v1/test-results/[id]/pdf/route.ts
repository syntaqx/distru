import { authenticate, requireScope } from "@/lib/public-api";
import { getTestResult } from "@/lib/modules/compliance";
import { simplePdf, pdfResponse } from "@/lib/pdf";
import { testResultLines } from "@/lib/pdf-test-result";

/** GET /public/v1/test-results/{id}/pdf — a printable COA / lab test result. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const row = await getTestResult(auth.ctx, id);
  if (!row) {
    return pdfResponse(
      simplePdf("Test Result", [`ID: ${id}`, "No test result on file."]),
      `test-result-${id}`,
    );
  }
  return pdfResponse(
    simplePdf("Test Result", testResultLines(row)),
    `test-result-${row.id}`,
  );
}
