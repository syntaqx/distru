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
    packageId?: string | null;
    metrcLabTestId?: string | null;
    name?: string | null;
    coaUrl?: string | null;
    thcPercentage?: string | number | null;
    cbdPercentage?: string | number | null;
    thcMgPerUnit?: string | number | null;
    cbdMgPerUnit?: string | number | null;
    testedAt?: Date | null;
    passed?: string | null;
    results?: Record<string, unknown>;
  },
) {
  const numOrNull = (v: string | number | null | undefined) =>
    v == null ? v : String(v);
  const potency = {
    ...(input.thcPercentage !== undefined ? { thcPercentage: numOrNull(input.thcPercentage) } : {}),
    ...(input.cbdPercentage !== undefined ? { cbdPercentage: numOrNull(input.cbdPercentage) } : {}),
    ...(input.thcMgPerUnit !== undefined ? { thcMgPerUnit: numOrNull(input.thcMgPerUnit) } : {}),
    ...(input.cbdMgPerUnit !== undefined ? { cbdMgPerUnit: numOrNull(input.cbdMgPerUnit) } : {}),
  };
  if (input.id) {
    const [row] = await db
      .update(testResults)
      .set({
        ...(input.productId !== undefined ? { productId: input.productId } : {}),
        ...(input.packageId !== undefined ? { packageId: input.packageId } : {}),
        ...(input.metrcLabTestId !== undefined ? { metrcLabTestId: input.metrcLabTestId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.coaUrl !== undefined ? { coaUrl: input.coaUrl } : {}),
        ...potency,
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
      packageId: input.packageId ?? null,
      metrcLabTestId: input.metrcLabTestId ?? null,
      name: input.name ?? null,
      coaUrl: input.coaUrl ?? null,
      ...potency,
      testedAt: input.testedAt ?? null,
      passed: input.passed ?? null,
      ...(input.results !== undefined ? { results: input.results } : {}),
    })
    .returning();
  return { row, created: true };
}

/** The COA tied directly to a package (lot-level), most recent first. */
export async function getPackageTestResult(ctx: ServiceCtx, packageId: string) {
  const [row] = await db
    .select()
    .from(testResults)
    .where(and(eq(testResults.organizationId, ctx.orgId), eq(testResults.packageId, packageId)))
    .orderBy(desc(testResults.createdAt))
    .limit(1);
  return row ?? null;
}

export function testResultToApi(row: TestResultRow) {
  const n = (v: string | null) => (v == null ? null : v);
  return {
    id: row.id,
    name: row.name ?? null,
    product_id: row.productId ?? null,
    package_id: row.packageId ?? null,
    metrc_lab_test_id: row.metrcLabTestId ?? null,
    coa_url: row.coaUrl ?? null,
    thc_percentage: n(row.thcPercentage),
    cbd_percentage: n(row.cbdPercentage),
    thc_mg_per_unit: n(row.thcMgPerUnit),
    cbd_mg_per_unit: n(row.cbdMgPerUnit),
    tested_datetime: datetime(row.testedAt),
    passed: row.passed ?? null,
    results: row.results,
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}
