import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { assemblies, assemblyInputs, assemblyOutputs, assemblyReservations, costs } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { customData, datetime, num, recordAudit } from "@/lib/modules/shared";
import {
  InsufficientStockError,
  getOnHand,
  issueStock,
  receiveStock,
} from "@/lib/modules/inventory";
import { getDefaultLocation } from "@/lib/modules/catalog";
import { reserveAssembly, releaseAssembly, type AssemblyReservationRow } from "./reservations";

export type AssemblyRow = typeof assemblies.$inferSelect;
export type AssemblyInputRow = typeof assemblyInputs.$inferSelect;
export type AssemblyOutputRow = typeof assemblyOutputs.$inferSelect;
export type AssemblyCostRow = typeof costs.$inferSelect;

export type AssemblyStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELED";

/** A hydrated assembly: the row plus its inputs, outputs, costs, and reservations. */
export type AssemblyWithLines = AssemblyRow & {
  inputs: AssemblyInputRow[];
  outputs: AssemblyOutputRow[];
  costs: AssemblyCostRow[];
  reservations: AssemblyReservationRow[];
};

export type AssemblyLineInput = {
  productId?: string | null;
  quantity: number | string;
  /** For an output line: the inputs consumed to make it (Distru nesting). */
  inputs?: AssemblyLineInput[];
};

export type AssemblyInput = {
  id?: string;
  assemblyNumber?: string;
  status?: AssemblyStatus;
  locationId?: string | null;
  notes?: string | null;
  /** Planned production window + effort (production scheduling). */
  scheduledStart?: Date | string | null;
  scheduledEnd?: Date | string | null;
  estimatedWorkMinutes?: number | null;
  assignedTo?: string | null;
  inputs?: AssemblyLineInput[];
  outputs?: AssemblyLineInput[];
};

/** Coerce a Date | ISO string | null into a Date | null for a timestamp column. */
function toDate(v: Date | string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return v instanceof Date ? v : new Date(v);
}

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
  const [inputs, outputs, appliedCosts, reservations] = await Promise.all([
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
    db
      .select()
      .from(assemblyReservations)
      .where(and(eq(assemblyReservations.organizationId, ctx.orgId), eq(assemblyReservations.assemblyId, id)))
      .orderBy(asc(assemblyReservations.createdAt)),
  ]);
  return { ...row, inputs, outputs, costs: appliedCosts, reservations };
}

/**
 * Replace the *shared* input lines (those not tied to a specific output) for an
 * assembly. Inputs nested under an output are managed by `replaceOutputs`.
 */
async function replaceInputs(ctx: ServiceCtx, assemblyId: string, lines: AssemblyLineInput[]) {
  await db
    .delete(assemblyInputs)
    .where(and(eq(assemblyInputs.assemblyId, assemblyId), isNull(assemblyInputs.outputId)));
  if (lines.length === 0) return;
  await db.insert(assemblyInputs).values(
    lines.map((l) => ({
      organizationId: ctx.orgId,
      assemblyId,
      outputId: null,
      productId: l.productId ?? null,
      quantity: String(l.quantity),
    })),
  );
}

/**
 * Replace all output lines (and any inputs nested under them). Deleting an
 * output cascades to its nested inputs; shared inputs are left untouched.
 */
async function replaceOutputs(ctx: ServiceCtx, assemblyId: string, lines: AssemblyLineInput[]) {
  await db.delete(assemblyOutputs).where(eq(assemblyOutputs.assemblyId, assemblyId));
  if (lines.length === 0) return;
  for (const l of lines) {
    const [out] = await db
      .insert(assemblyOutputs)
      .values({
        organizationId: ctx.orgId,
        assemblyId,
        productId: l.productId ?? null,
        quantity: String(l.quantity),
      })
      .returning({ id: assemblyOutputs.id });
    if (l.inputs?.length) {
      await db.insert(assemblyInputs).values(
        l.inputs.map((i) => ({
          organizationId: ctx.orgId,
          assemblyId,
          outputId: out.id,
          productId: i.productId ?? null,
          quantity: String(i.quantity),
        })),
      );
    }
  }
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
        ...(input.scheduledStart !== undefined ? { scheduledStart: toDate(input.scheduledStart) } : {}),
        ...(input.scheduledEnd !== undefined ? { scheduledEnd: toDate(input.scheduledEnd) } : {}),
        ...(input.estimatedWorkMinutes !== undefined ? { estimatedWorkMinutes: input.estimatedWorkMinutes } : {}),
        ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(assemblies.organizationId, ctx.orgId), eq(assemblies.id, input.id)))
      .returning();
    if (!row) throw new Error("Assembly not found.");
    if (row.inventoryPosted && input.status === "CANCELED")
      throw new Error("A completed assembly has posted its inventory and cannot be canceled.");
    if (input.inputs) await replaceInputs(ctx, row.id, input.inputs);
    if (input.outputs) await replaceOutputs(ctx, row.id, input.outputs);
    await applyReservationTransition(ctx, row.id, row.status, input.inputs !== undefined);
    if (row.status === "COMPLETED" && !row.inventoryPosted) {
      const posted = await postAssemblyInventory(ctx, row.id);
      return { row: posted, created: false };
    }
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
      scheduledStart: toDate(input.scheduledStart) ?? null,
      scheduledEnd: toDate(input.scheduledEnd) ?? null,
      estimatedWorkMinutes: input.estimatedWorkMinutes ?? null,
      assignedTo: input.assignedTo ?? null,
    })
    .returning();
  if (input.inputs) await replaceInputs(ctx, row.id, input.inputs);
  if (input.outputs) await replaceOutputs(ctx, row.id, input.outputs);
  await applyReservationTransition(ctx, row.id, row.status, input.inputs !== undefined);
  if (row.status === "COMPLETED") {
    const posted = await postAssemblyInventory(ctx, row.id);
    return { row: posted, created: true };
  }
  return { row, created: true };
}

/**
 * Keep input reservations in step with the run's status:
 *  - IN_PROGRESS  -> hold input stock (refresh the hold when the lines changed)
 *  - COMPLETED    -> release the soft hold (FIFO posting consumes the real stock)
 *  - CANCELED     -> release the soft hold
 * PENDING (planned/scheduled) holds nothing; the plan is visible but not committed.
 */
async function applyReservationTransition(
  ctx: ServiceCtx,
  assemblyId: string,
  status: AssemblyStatus,
  linesChanged: boolean,
) {
  if (status === "IN_PROGRESS") {
    if (linesChanged) await releaseAssembly(ctx, assemblyId);
    await reserveAssembly(ctx, assemblyId);
  } else if (status === "COMPLETED" || status === "CANCELED") {
    await releaseAssembly(ctx, assemblyId);
  }
}

/**
 * Post a completed run's inventory movements: consume each input FIFO (real
 * COGS), roll that plus the applied costs into a per-unit output cost, and
 * produce each output as a costed lot. Idempotent (guarded by `inventoryPosted`)
 * and pre-validates every input against on-hand so a shortfall blocks the whole
 * run before anything is consumed.
 */
export async function postAssemblyInventory(ctx: ServiceCtx, assemblyId: string) {
  const assembly = await getAssembly(ctx, assemblyId);
  if (!assembly) throw new Error("Assembly not found.");
  if (assembly.inventoryPosted) return assembly;

  const inputs = assembly.inputs.filter((i) => i.productId && Number(i.quantity) > 0);
  const outputs = assembly.outputs.filter((o) => o.productId && Number(o.quantity) > 0);
  if (outputs.length === 0) {
    // Nothing to produce - mark posted so we don't retry, but move no stock.
    await db
      .update(assemblies)
      .set({ inventoryPosted: true, completionDatetime: new Date() })
      .where(eq(assemblies.id, assemblyId));
    return (await getAssembly(ctx, assemblyId))!;
  }

  const locationId = assembly.locationId ?? (await getDefaultLocation(ctx)).id;

  // Pre-flight: every input must have enough on-hand, or the run blocks whole.
  for (const input of inputs) {
    const available = await getOnHand(ctx, input.productId!, locationId);
    const need = Number(input.quantity);
    if (need > available) {
      throw new InsufficientStockError(input.productId!, need, available, locationId);
    }
  }

  // Consume inputs FIFO → input COGS.
  let inputCogs = 0;
  for (const input of inputs) {
    const { cogs } = await issueStock(ctx, {
      productId: input.productId!,
      locationId,
      qty: Number(input.quantity),
      reason: `assembly:${assembly.assemblyNumber}`,
      refType: "ASSEMBLY",
      refId: assembly.id,
    });
    inputCogs += cogs;
  }

  // Applied costs (labor, overhead, packaging) roll into the output cost too.
  const appliedCosts = assembly.costs.reduce((sum, c) => sum + Number(c.amount), 0);
  const totalCost = inputCogs + appliedCosts;
  const totalOutputQty = outputs.reduce((sum, o) => sum + Number(o.quantity), 0);
  const unitCost = totalOutputQty > 0 ? totalCost / totalOutputQty : 0;

  // Produce outputs as costed lots.
  for (const output of outputs) {
    await receiveStock(ctx, {
      productId: output.productId!,
      locationId,
      qty: Number(output.quantity),
      unitCost,
      sourceType: "ASSEMBLY",
      sourceId: assembly.id,
      reason: `assembly:${assembly.assemblyNumber}`,
    });
    await db
      .update(assemblyOutputs)
      .set({ unitCost: String(unitCost) })
      .where(eq(assemblyOutputs.id, output.id));
  }

  await db
    .update(assemblies)
    .set({ inventoryPosted: true, completionDatetime: new Date() })
    .where(eq(assemblies.id, assemblyId));

  await recordAudit(ctx, {
    action: "assembly.complete",
    entityType: "assembly",
    entityId: assembly.id,
    after: { inputCogs, appliedCosts, totalCost, unitCost, outputs: outputs.length },
  });
  return (await getAssembly(ctx, assemblyId))!;
}

export function assemblyToApi(row: AssemblyRow | AssemblyWithLines) {
  const inputs = "inputs" in row ? row.inputs : [];
  const outputs = "outputs" in row ? row.outputs : [];
  const appliedCosts = "costs" in row ? row.costs : [];
  const inputLine = (i: AssemblyInputRow) => ({
    id: i.id,
    product_id: i.productId,
    quantity: num(i.quantity),
  });
  const reservations = "reservations" in row ? row.reservations : [];
  const activeReservations = reservations.filter((r) => r.status === "ACTIVE");
  const sharedInputs = inputs.filter((i) => !i.outputId);
  return {
    id: row.id,
    assembly_number: row.assemblyNumber,
    status: row.status,
    location_id: row.locationId ?? null,
    // Production scheduling.
    scheduled_start_datetime: datetime(row.scheduledStart),
    scheduled_end_datetime: datetime(row.scheduledEnd),
    estimated_work_minutes: row.estimatedWorkMinutes ?? null,
    assigned_to: row.assignedTo ?? null,
    completion_datetime: datetime(row.completionDatetime),
    inventory_posted: row.inventoryPosted,
    // Whether input stock is currently soft-held for this (not-yet-posted) run.
    is_reserved: activeReservations.length > 0,
    reservations: activeReservations.map((r) => ({
      id: r.id,
      product_id: r.productId,
      location_id: r.locationId,
      quantity: num(r.quantity),
      status: r.status,
    })),
    notes: row.notes ?? null,
    custom_data: customData(row.customFields),
    // Kept flat for convenience...
    inputs: inputs.map(inputLine),
    // ...and nested under each output (Distru's shape): an output's own inputs,
    // plus the shared inputs when there's a single output.
    outputs: outputs.map((o) => ({
      id: o.id,
      product_id: o.productId,
      quantity: num(o.quantity),
      unit_cost: num(o.unitCost),
      is_finished_good: true,
      inputs: [
        ...inputs.filter((i) => i.outputId === o.id),
        ...(outputs.length === 1 ? sharedInputs : []),
      ].map(inputLine),
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
