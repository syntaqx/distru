import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assemblies, assemblyInputs, assemblyOutputs, costs } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { customData, datetime, num } from "@/lib/modules/shared";

export type AssemblyRow = typeof assemblies.$inferSelect;
export type AssemblyInputRow = typeof assemblyInputs.$inferSelect;
export type AssemblyOutputRow = typeof assemblyOutputs.$inferSelect;
export type AssemblyCostRow = typeof costs.$inferSelect;

export type AssemblyStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

/** A hydrated assembly: the row plus its inputs, outputs, and costs. */
export type AssemblyWithLines = AssemblyRow & {
  inputs: AssemblyInputRow[];
  outputs: AssemblyOutputRow[];
  costs: AssemblyCostRow[];
};

export type AssemblyLineInput = { productId?: string | null; quantity: number | string };

export type AssemblyInput = {
  id?: string;
  assemblyNumber?: string;
  status?: AssemblyStatus;
  locationId?: string | null;
  notes?: string | null;
  inputs?: AssemblyLineInput[];
  outputs?: AssemblyLineInput[];
};

/** Next per-org assembly number, e.g. ASM-0001. */
export async function nextAssemblyNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(assemblies)
    .where(eq(assemblies.organizationId, ctx.orgId));
  return `ASM-${String(Number(value) + 1).padStart(4, "0")}`;
}

export async function listAssemblies(
  ctx: ServiceCtx,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const items = await db
    .select()
    .from(assemblies)
    .where(eq(assemblies.organizationId, ctx.orgId))
    .orderBy(desc(assemblies.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(assemblies)
    .where(eq(assemblies.organizationId, ctx.orgId));
  return { items, total: Number(total), limit, offset };
}

export async function getAssembly(
  ctx: ServiceCtx,
  id: string,
): Promise<AssemblyWithLines | null> {
  const [row] = await db
    .select()
    .from(assemblies)
    .where(and(eq(assemblies.organizationId, ctx.orgId), eq(assemblies.id, id)))
    .limit(1);
  if (!row) return null;
  const [inputs, outputs, appliedCosts] = await Promise.all([
    db
      .select()
      .from(assemblyInputs)
      .where(eq(assemblyInputs.assemblyId, id))
      .orderBy(asc(assemblyInputs.createdAt)),
    db
      .select()
      .from(assemblyOutputs)
      .where(eq(assemblyOutputs.assemblyId, id))
      .orderBy(asc(assemblyOutputs.createdAt)),
    db
      .select()
      .from(costs)
      .where(and(eq(costs.organizationId, ctx.orgId), eq(costs.assemblyId, id)))
      .orderBy(asc(costs.createdAt)),
  ]);
  return { ...row, inputs, outputs, costs: appliedCosts };
}

/** Replace all input lines for an assembly (delete existing then insert). */
async function replaceInputs(ctx: ServiceCtx, assemblyId: string, lines: AssemblyLineInput[]) {
  await db.delete(assemblyInputs).where(eq(assemblyInputs.assemblyId, assemblyId));
  if (lines.length === 0) return;
  await db.insert(assemblyInputs).values(
    lines.map((l) => ({
      organizationId: ctx.orgId,
      assemblyId,
      productId: l.productId ?? null,
      quantity: String(l.quantity),
    })),
  );
}

/** Replace all output lines for an assembly (delete existing then insert). */
async function replaceOutputs(ctx: ServiceCtx, assemblyId: string, lines: AssemblyLineInput[]) {
  await db.delete(assemblyOutputs).where(eq(assemblyOutputs.assemblyId, assemblyId));
  if (lines.length === 0) return;
  await db.insert(assemblyOutputs).values(
    lines.map((l) => ({
      organizationId: ctx.orgId,
      assemblyId,
      productId: l.productId ?? null,
      quantity: String(l.quantity),
    })),
  );
}

/**
 * Sparse upsert: with id updates changed fields; without id creates, generating
 * an assembly number if none is supplied. Input/output lines, when provided, are
 * replaced wholesale.
 */
export async function upsertAssembly(ctx: ServiceCtx, input: AssemblyInput) {
  if (input.id) {
    const [row] = await db
      .update(assemblies)
      .set({
        ...(input.assemblyNumber != null ? { assemblyNumber: input.assemblyNumber.trim() } : {}),
        ...(input.status != null ? { status: input.status } : {}),
        ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(assemblies.organizationId, ctx.orgId), eq(assemblies.id, input.id)))
      .returning();
    if (!row) throw new Error("Assembly not found.");
    if (input.inputs) await replaceInputs(ctx, row.id, input.inputs);
    if (input.outputs) await replaceOutputs(ctx, row.id, input.outputs);
    // TODO: posting input/output inventory movements is a documented follow-up
    return { row, created: false };
  }
  const assemblyNumber = input.assemblyNumber ?? (await nextAssemblyNumber(ctx));
  const [row] = await db
    .insert(assemblies)
    .values({
      organizationId: ctx.orgId,
      assemblyNumber,
      status: input.status ?? "PENDING",
      locationId: input.locationId ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  if (input.inputs) await replaceInputs(ctx, row.id, input.inputs);
  if (input.outputs) await replaceOutputs(ctx, row.id, input.outputs);
  // TODO: posting input/output inventory movements is a documented follow-up
  return { row, created: true };
}

export function assemblyToApi(row: AssemblyRow | AssemblyWithLines) {
  const inputs = "inputs" in row ? row.inputs : [];
  const outputs = "outputs" in row ? row.outputs : [];
  const appliedCosts = "costs" in row ? row.costs : [];
  return {
    id: row.id,
    assembly_number: row.assemblyNumber,
    status: row.status,
    location_id: row.locationId ?? null,
    completion_datetime: datetime(row.completionDatetime),
    notes: row.notes ?? null,
    custom_data: customData(row.customFields),
    inputs: inputs.map((i) => ({
      id: i.id,
      product_id: i.productId,
      quantity: num(i.quantity),
    })),
    outputs: outputs.map((o) => ({
      id: o.id,
      product_id: o.productId,
      quantity: num(o.quantity),
    })),
    costs: appliedCosts.map((c) => ({
      id: c.id,
      cost_type_id: c.costTypeId,
      description: c.description ?? null,
      amount: num(c.amount),
    })),
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}
