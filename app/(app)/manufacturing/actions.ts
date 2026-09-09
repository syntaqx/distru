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

  const service = await svc();
  try {
    const { row } = await upsertAssembly(service, {
      id: form.id,
      status: form.status,
      notes: form.notes?.trim() ? form.notes.trim() : null,
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
