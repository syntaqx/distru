import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listTestResults, upsertTestResult, testResultToApi } from "@/lib/modules/compliance";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:read");
  if (scopeErr) return scopeErr;
  const offset = pageOffset(req);
  const { items, total } = await listTestResults(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(testResultToApi), offset, total);
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "compliance:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");
  try {
    const { row, created } = await upsertTestResult(auth.ctx, {
      id: body.id as string | undefined,
      productId: (body.product_id as string) ?? null,
      metrcLabTestId: (body.metrc_lab_test_id as string) ?? null,
      testedAt: body.tested_datetime ? new Date(body.tested_datetime as string) : null,
      passed: (body.passed as string) ?? null,
      results: body.results as Record<string, unknown> | undefined,
    });
    return Response.json({ data: testResultToApi(row) }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
