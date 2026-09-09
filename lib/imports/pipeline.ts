import type { ServiceCtx } from "@/lib/modules/shared";
import {
  countByStatus,
  getJob,
  getRowsPage,
  updateJob,
  updateRow,
  type ImportRow,
} from "@/lib/modules/imports";
import { getTarget } from "./registry";
import type { ColumnMapping, RowError, ValidationSummary } from "./types";

const VALIDATE_CHUNK = 500;
const COMMIT_CHUNK = 200;

/** Project a raw source row into a canonical-field-keyed record via the mapping. */
export function applyMapping(
  mapping: ColumnMapping,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const entry of mapping.entries) {
    if (entry.sourceColumn) mapped[entry.targetField] = raw[entry.sourceColumn];
  }
  return mapped;
}

/**
 * Validate every row against the target's schema, in chunks. Persists per-row
 * status/errors and returns an aggregate summary for the agent - the raw rows
 * never enter the model context.
 */
export async function validateImport(
  ctx: ServiceCtx,
  jobId: string,
): Promise<ValidationSummary> {
  const job = await getJob(ctx, jobId);
  if (!job) throw new Error("Import job not found");
  if (!job.mapping) throw new Error("Import job has no column mapping yet");

  const target = getTarget(job.targetKey);
  const prep = await target.prepare(ctx);
  const mapping = job.mapping as ColumnMapping;

  await updateJob(ctx, jobId, { status: "VALIDATING" });

  const errorCounts = new Map<string, number>();
  const newRefSet = new Map<string, Set<string>>();
  let total = 0;
  let valid = 0;
  let warning = 0;
  let error = 0;

  for (let offset = 0; ; offset += VALIDATE_CHUNK) {
    const rows = await getRowsPage(ctx, jobId, { offset, limit: VALIDATE_CHUNK });
    if (rows.length === 0) break;

    for (const row of rows) {
      total++;
      const mapped = applyMapping(mapping, row.raw);
      const result = target.validateRow(mapped, prep);

      for (const nr of result.newRefs ?? []) {
        if (!newRefSet.has(nr.kind)) newRefSet.set(nr.kind, new Set());
        newRefSet.get(nr.kind)!.add(nr.value);
      }

      if (!result.ok) {
        error++;
        for (const e of result.errors)
          errorCounts.set(e.message, (errorCounts.get(e.message) ?? 0) + 1);
        await updateRow(row.id, {
          mapped,
          status: "ERROR",
          errors: result.errors,
        });
      } else if (result.warnings && result.warnings.length > 0) {
        warning++;
        await updateRow(row.id, {
          mapped,
          status: "WARNING",
          errors: result.warnings,
        });
      } else {
        valid++;
        await updateRow(row.id, { mapped, status: "VALID", errors: [] });
      }
    }
  }

  await updateJob(ctx, jobId, {
    status: "READY",
    totalRows: total,
    validRows: valid,
    warningRows: warning,
    errorRows: error,
  });

  const topErrors = [...errorCounts.entries()]
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const newReferences = [...newRefSet.entries()].map(([kind, values]) => ({
    kind,
    values: [...values].slice(0, 50),
  }));

  return { total, valid, warning, error, topErrors, newReferences };
}

/**
 * Commit every VALID/WARNING row via the target, in chunks. Re-derives the
 * validated value from the persisted mapped row (deterministic), so nothing
 * extra is stored. Supports partial success.
 */
export async function commitImport(ctx: ServiceCtx, jobId: string) {
  const job = await getJob(ctx, jobId);
  if (!job) throw new Error("Import job not found");
  const target = getTarget(job.targetKey);
  const prep = await target.prepare(ctx);

  await updateJob(ctx, jobId, { status: "COMMITTING" });

  let committed = 0;
  for (let offset = 0; ; offset += COMMIT_CHUNK) {
    const rows = await getRowsPage(ctx, jobId, { offset, limit: COMMIT_CHUNK });
    if (rows.length === 0) break;

    const committable = rows.filter(
      (r) => r.status === "VALID" || r.status === "WARNING",
    );
    if (committable.length === 0) continue;

    const values: { value: unknown; row: ImportRow }[] = [];
    for (const row of committable) {
      const res = target.validateRow(row.mapped ?? {}, prep);
      if (res.ok) values.push({ value: res.value, row });
    }

    const outcomes = await target.commitRows(
      values.map((v) => ({ value: v.value })),
      ctx,
      prep,
    );

    for (let i = 0; i < values.length; i++) {
      await updateRow(values[i].row.id, {
        status: "COMMITTED",
        productId: outcomes[i]?.productId ?? null,
      });
      committed++;
    }
  }

  const counts = await countByStatus(ctx, jobId);
  const errorRows = counts["ERROR"] ?? 0;
  await updateJob(ctx, jobId, {
    status: errorRows > 0 ? "PARTIAL" : "DONE",
    committedRows: committed,
  });

  return { committed, errorRows };
}

export function summarizeRowErrors(errors: RowError[]): string {
  return errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)).join("; ");
}
