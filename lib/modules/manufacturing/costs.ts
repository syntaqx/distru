import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { costTypes, costs } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, num } from "@/lib/modules/shared";

// ---------------- Cost types (reference data) ----------------

export type CostTypeRow = typeof costTypes.$inferSelect;

export async function listCostTypes(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const items = await db
    .select()
    .from(costTypes)
    .where(eq(costTypes.organizationId, ctx.orgId))
    .orderBy(asc(costTypes.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(costTypes)
    .where(eq(costTypes.organizationId, ctx.orgId));
  return { items, total: Number(total), limit, offset };
}

export async function getCostType(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(costTypes)
    .where(and(eq(costTypes.organizationId, ctx.orgId), eq(costTypes.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates changed fields; without id creates. */
export async function upsertCostType(
  ctx: ServiceCtx,
  input: { id?: string; name?: string },
) {
  if (input.id) {
    const [row] = await db
      .update(costTypes)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(costTypes.organizationId, ctx.orgId), eq(costTypes.id, input.id)))
      .returning();
    if (!row) throw new Error("Cost type not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required to create a cost type.");
  const [row] = await db
    .insert(costTypes)
    .values({ organizationId: ctx.orgId, name: input.name.trim() })
    .returning();
  return { row, created: true };
}

export function costTypeToApi(row: CostTypeRow) {
  return {
    id: row.id,
    name: row.name,
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}

// ---------------- Costs (applied to an assembly) ----------------

export type CostRow = typeof costs.$inferSelect;

export async function listCosts(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const items = await db
    .select()
    .from(costs)
    .where(eq(costs.organizationId, ctx.orgId))
    .orderBy(desc(costs.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(costs)
    .where(eq(costs.organizationId, ctx.orgId));
  return { items, total: Number(total), limit, offset };
}

export async function getCost(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(costs)
    .where(and(eq(costs.organizationId, ctx.orgId), eq(costs.id, id)))
    .limit(1);
  return row ?? null;
}

/** Sparse upsert: with id updates changed fields; without id creates. `costs` has no updatedAt. */
export async function upsertCost(
  ctx: ServiceCtx,
  input: {
    id?: string;
    assemblyId?: string | null;
    costTypeId?: string | null;
    description?: string | null;
    amount?: number | string;
  },
) {
  if (input.id) {
    const [row] = await db
      .update(costs)
      .set({
        ...(input.assemblyId !== undefined ? { assemblyId: input.assemblyId } : {}),
        ...(input.costTypeId !== undefined ? { costTypeId: input.costTypeId } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
      })
      .where(and(eq(costs.organizationId, ctx.orgId), eq(costs.id, input.id)))
      .returning();
    if (!row) throw new Error("Cost not found.");
    return { row, created: false };
  }
  if (input.amount === undefined || input.amount === null)
    throw new Error("amount is required to create a cost.");
  const [row] = await db
    .insert(costs)
    .values({
      organizationId: ctx.orgId,
      assemblyId: input.assemblyId ?? null,
      costTypeId: input.costTypeId ?? null,
      description: input.description ?? null,
      amount: String(input.amount),
    })
    .returning();
  return { row, created: true };
}

export function costToApi(row: CostRow) {
  return {
    id: row.id,
    assembly_id: row.assemblyId,
    cost_type_id: row.costTypeId,
    description: row.description ?? null,
    amount: num(row.amount),
    inserted_datetime: datetime(row.createdAt),
  };
}
