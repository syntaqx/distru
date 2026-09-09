import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { importFiles, importJobs, importRows } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import type { ColumnMapping, RowError } from "@/lib/imports/types";

export type ImportJob = typeof importJobs.$inferSelect;
export type ImportRow = typeof importRows.$inferSelect;
export type ImportFile = typeof importFiles.$inferSelect;

export async function createImportFile(
  ctx: ServiceCtx,
  input: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    contentBase64: string;
    headers: string[];
    sampleRows: Record<string, unknown>[];
    rowCount: number;
  },
) {
  const [row] = await db
    .insert(importFiles)
    .values({ organizationId: ctx.orgId, ...input })
    .returning();
  return row;
}

export async function createImportJob(
  ctx: ServiceCtx,
  input: {
    fileId: string;
    targetKey: string;
    createdBy?: string | null;
    conversationId?: string | null;
    totalRows: number;
  },
) {
  const [row] = await db
    .insert(importJobs)
    .values({
      organizationId: ctx.orgId,
      fileId: input.fileId,
      targetKey: input.targetKey,
      createdBy: input.createdBy ?? null,
      conversationId: input.conversationId ?? null,
      totalRows: input.totalRows,
      status: "UPLOADED",
    })
    .returning();
  return row;
}

export async function getJob(ctx: ServiceCtx, jobId: string) {
  const [row] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.organizationId, ctx.orgId), eq(importJobs.id, jobId)))
    .limit(1);
  return row ?? null;
}

export async function getFile(ctx: ServiceCtx, fileId: string) {
  const [row] = await db
    .select()
    .from(importFiles)
    .where(and(eq(importFiles.organizationId, ctx.orgId), eq(importFiles.id, fileId)))
    .limit(1);
  return row ?? null;
}

export async function updateJob(
  ctx: ServiceCtx,
  jobId: string,
  patch: Partial<{
    status: ImportJob["status"];
    targetKey: string;
    mapping: ColumnMapping | null;
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    committedRows: number;
  }>,
) {
  const [row] = await db
    .update(importJobs)
    .set(patch)
    .where(and(eq(importJobs.organizationId, ctx.orgId), eq(importJobs.id, jobId)))
    .returning();
  return row;
}

export async function insertRows(
  ctx: ServiceCtx,
  jobId: string,
  rows: { rowIndex: number; raw: Record<string, unknown> }[],
) {
  if (rows.length === 0) return;
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    await db.insert(importRows).values(
      slice.map((r) => ({
        jobId,
        organizationId: ctx.orgId,
        rowIndex: r.rowIndex,
        raw: r.raw,
      })),
    );
  }
}

export async function getRowsPage(
  ctx: ServiceCtx,
  jobId: string,
  args: { offset: number; limit: number },
) {
  return db
    .select()
    .from(importRows)
    .where(and(eq(importRows.organizationId, ctx.orgId), eq(importRows.jobId, jobId)))
    .orderBy(asc(importRows.rowIndex))
    .limit(args.limit)
    .offset(args.offset);
}

export async function updateRow(
  rowId: string,
  patch: Partial<{
    mapped: Record<string, unknown> | null;
    status: ImportRow["status"];
    errors: RowError[];
    productId: string | null;
  }>,
) {
  await db.update(importRows).set(patch).where(eq(importRows.id, rowId));
}

export async function countByStatus(ctx: ServiceCtx, jobId: string) {
  const rows = await db
    .select({
      status: importRows.status,
      value: sql<string>`count(*)`,
    })
    .from(importRows)
    .where(and(eq(importRows.organizationId, ctx.orgId), eq(importRows.jobId, jobId)))
    .groupBy(importRows.status);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = Number(r.value);
  return counts;
}
