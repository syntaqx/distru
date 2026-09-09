import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { testResults } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";

export type TestResultRow = typeof testResults.$inferSelect;

export async function listTestResults(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where = eq(testResults.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(testResults)
    .where(where)
    .orderBy(desc(testResults.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(testResults)
    .where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getTestResult(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(testResults)
    .where(and(eq(testResults.organizationId, ctx.orgId), eq(testResults.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates only changed fields; without id creates. */
export async function upsertTestResult(
  ctx: ServiceCtx,
  input: {
    id?: string;
    productId?: string | null;
    metrcLabTestId?: string | null;
    testedAt?: Date | null;
    passed?: string | null;
    results?: Record<string, unknown>;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(testResults)
      .set({
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        ...(input.metrcLabTestId !== undefined ? { metrcLabTestId: input.metrcLabTestId } : {}),
        ...(input.testedAt !== undefined ? { testedAt: input.testedAt } : {}),
        ...(input.passed !== undefined ? { passed: input.passed } : {}),
        ...(input.results !== undefined ? { results: input.results } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(testResults.organizationId, ctx.orgId), eq(testResults.id, input.id)))
      .returning();
    if (!row) throw new Error("Test result not found.");
    return { row, created: false };
  }
  const [row] = await db
    .insert(testResults)
    .values({
      organizationId: ctx.orgId,
      productId: input.productId ?? null,
      metrcLabTestId: input.metrcLabTestId ?? null,
      testedAt: input.testedAt ?? null,
      passed: input.passed ?? null,
      ...(input.results !== undefined ? { results: input.results } : {}),
    })
    .returning();
  return { row, created: true };
}

export function testResultToApi(row: TestResultRow) {
  return {
    id: row.id,
    product_id: row.productId ?? null,
    metrc_lab_test_id: row.metrcLabTestId ?? null,
    tested_datetime: datetime(row.testedAt),
    passed: row.passed ?? null,
    results: row.results,
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}
