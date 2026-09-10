"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  upsertAssembly,
  upsertCost,
  upsertCostType,
  type AssemblyStatus,
} from "@/lib/modules/manufacturing";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

export type AssemblyLineForm = { productId: string; quantity: string };

export type AssemblyForm = {
  id?: string;
  status: AssemblyStatus;
  outputProductId: string;
  outputQuantity: string;
  inputs: AssemblyLineForm[];
  notes?: string;
  // Production scheduling (all optional; a planned run stays PENDING).
  scheduledStart?: string;
  scheduledEnd?: string;
  estimatedWorkMinutes?: string;
  assignedTo?: string;
};

export async function saveAssemblyAction(
  form: AssemblyForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.outputProductId) return { ok: false, error: "Pick an output product." };
  const outQty = Number(form.outputQuantity);
  if (!Number.isFinite(outQty) || outQty <= 0)
    return { ok: false, error: "Output quantity must be greater than zero." };

  const inputs = form.inputs.filter((l) => l.productId && Number(l.quantity) > 0);
  if (inputs.length === 0)
    return { ok: false, error: "Add at least one input line." };

  const estMinutes = form.estimatedWorkMinutes?.trim()
    ? Number(form.estimatedWorkMinutes)
    : null;
  if (estMinutes != null && (!Number.isFinite(estMinutes) || estMinutes < 0))
    return { ok: false, error: "Estimated work minutes must be a positive number." };

  const service = await svc();
  try {
    const { row } = await upsertAssembly(service, {
      id: form.id,
      status: form.status,
      notes: form.notes?.trim() ? form.notes.trim() : null,
      scheduledStart: form.scheduledStart?.trim() ? form.scheduledStart : null,
      scheduledEnd: form.scheduledEnd?.trim() ? form.scheduledEnd : null,
      estimatedWorkMinutes: estMinutes,
      assignedTo: form.assignedTo?.trim() ? form.assignedTo.trim() : null,
      outputs: [{ productId: form.outputProductId, quantity: outQty }],
      inputs: inputs.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
    });
    revalidatePath("/manufacturing");
    revalidatePath(`/manufacturing/${row.id}`);
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

/**
 * Start an assembly run: PENDING (planned/scheduled) -> IN_PROGRESS. This opens
 * soft reservations on the input stock so it isn't double-committed by another
 * planned run. Real stock is only consumed later, on Complete.
 */
export async function startAssemblyAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    const { row } = await upsertAssembly(service, { id, status: "IN_PROGRESS" });
    revalidatePath("/manufacturing");
    revalidatePath(`/manufacturing/${row.id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not start run." };
  }
}

/** Update just the schedule (planned window, effort, assignee) of an assembly. */
export async function scheduleAssemblyAction(form: {
  id: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  estimatedWorkMinutes?: string | null;
  assignedTo?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const estMinutes =
    form.estimatedWorkMinutes != null && form.estimatedWorkMinutes.trim() !== ""
      ? Number(form.estimatedWorkMinutes)
      : null;
  if (estMinutes != null && (!Number.isFinite(estMinutes) || estMinutes < 0))
    return { ok: false, error: "Estimated work minutes must be a positive number." };
  const service = await svc();
  try {
    const { row } = await upsertAssembly(service, {
      id: form.id,
      scheduledStart: form.scheduledStart?.trim() ? form.scheduledStart : null,
      scheduledEnd: form.scheduledEnd?.trim() ? form.scheduledEnd : null,
      estimatedWorkMinutes: estMinutes,
      assignedTo: form.assignedTo?.trim() ? form.assignedTo.trim() : null,
    });
    revalidatePath("/manufacturing");
    revalidatePath(`/manufacturing/${row.id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save schedule." };
  }
}

/**
 * Complete an assembly run. Flipping status to COMPLETED posts inventory:
 * consumes inputs FIFO and produces outputs at a rolled unit cost. Surfaces the
 * thrown InsufficientStockError / any Error message to the caller.
 */
export async function completeAssemblyAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    const { row } = await upsertAssembly(service, { id, status: "COMPLETED" });
    revalidatePath("/manufacturing");
    revalidatePath(`/manufacturing/${row.id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not complete run." };
  }
}

export async function saveCostTypeAction(
  form: { id?: string; name: string },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.name?.trim()) return { ok: false, error: "Name is required." };
  const service = await svc();
  try {
    const { row } = await upsertCostType(service, { id: form.id, name: form.name });
    revalidatePath("/manufacturing");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function saveCostAction(
  form: {
    id?: string;
    assemblyId?: string | null;
    costTypeId?: string | null;
    description?: string | null;
    amount: string;
  },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const amount = Number(form.amount);
  if (!Number.isFinite(amount))
    return { ok: false, error: "Amount must be a number." };
  const service = await svc();
  try {
    const { row } = await upsertCost(service, {
      id: form.id,
      assemblyId: form.assemblyId ? form.assemblyId : null,
      costTypeId: form.costTypeId ? form.costTypeId : null,
      description: form.description?.trim() ? form.description.trim() : null,
      amount,
    });
    revalidatePath("/manufacturing");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
