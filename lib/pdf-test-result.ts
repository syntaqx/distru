import { listTestResults, type TestResultRow } from "@/lib/modules/compliance";
import type { ServiceCtx } from "@/lib/modules/shared";

/**
 * Find lab results tied to any of the given product ids. The compliance list
 * endpoint has no product filter, so we page a generous window and filter it —
 * enough for the document shortcuts hanging off orders, invoices, packages and
 * batches.
 */
export async function testResultsForProducts(
  ctx: ServiceCtx,
  productIds: Set<string>,
): Promise<TestResultRow[]> {
  if (productIds.size === 0) return [];
  const { items } = await listTestResults(ctx, { limit: 200 });
  return items.filter((t) => t.productId != null && productIds.has(t.productId));
}

/**
 * Render a lab test result (COA) row into the descending text lines a
 * `simplePdf` page draws. Shared by every test-result PDF endpoint (the
 * standalone one plus the order/invoice/package/batch shortcuts).
 */
export function testResultLines(row: TestResultRow): string[] {
  const tested = row.testedAt ? new Date(row.testedAt).toISOString().slice(0, 10) : "-";
  const lines = [
    `Result ID: ${row.id}`,
    `Product: ${row.productId ?? "-"}`,
    `Metrc Lab Test: ${row.metrcLabTestId ?? "-"}`,
    `Tested: ${tested}`,
    `Passed: ${row.passed ?? "-"}`,
  ];
  const results = (row.results ?? {}) as Record<string, unknown>;
  const entries = Object.entries(results);
  if (entries.length) {
    lines.push("", "Analytes:");
    for (const [key, value] of entries) {
      lines.push(`  ${key}: ${formatValue(value)}`);
    }
  }
  return lines;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
