import Papa from "papaparse";
import type { ServiceCtx } from "@/lib/modules/shared";
import { getFile, getJob, getRowsPage } from "@/lib/modules/imports";
import type { RowError } from "./types";

/**
 * Build a row-mapped error CSV: the customer's original columns, plus `_row`
 * and `_errors`, for exactly the rows that failed validation. Mirrors Distru's
 * bulk-upload error report so a customer can fix and re-upload.
 */
export async function buildErrorCsv(
  ctx: ServiceCtx,
  jobId: string,
): Promise<{ csv: string; errorRows: number } | null> {
  const job = await getJob(ctx, jobId);
  if (!job) return null;
  const file = await getFile(ctx, job.fileId);
  const headers = file?.headers ?? [];

  const failures: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await getRowsPage(ctx, jobId, { offset, limit: 1000 });
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row.status !== "ERROR") continue;
      const errs = (row.errors as RowError[]) ?? [];
      failures.push({
        _row: row.rowIndex + 1,
        ...row.raw,
        _errors: errs
          .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
          .join(" | "),
      });
    }
  }

  const fields = ["_row", ...headers, "_errors"];
  const csv = Papa.unparse(failures, { columns: fields });
  return { csv, errorRows: failures.length };
}
