"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import { upsertPackage, upsertBatch, upsertBin } from "@/lib/modules/inventory";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

type Result = { ok: boolean; error?: string; id?: string };

export type PackageForm = {
  id?: string;
  packageTag: string;
  productId?: string;
  locationId?: string;
  quantity?: string;
  status: string;
};

export async function savePackageAction(form: PackageForm): Promise<Result> {
  if (!form.packageTag?.trim())
    return { ok: false, error: "A package tag is required." };
  const service = await svc();
  try {
    const { row } = await upsertPackage(service, {
      id: form.id,
      packageTag: form.packageTag.trim(),
      productId: form.productId ? form.productId : null,
      locationId: form.locationId ? form.locationId : null,
      quantity: form.quantity?.trim() ? form.quantity.trim() : "0",
      status: form.status || "ACTIVE",
    });
    revalidatePath("/inventory/packages");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export type BatchForm = {
  id?: string;
  batchNumber: string;
  productId?: string;
};

export async function saveBatchAction(form: BatchForm): Promise<Result> {
  if (!form.batchNumber?.trim())
    return { ok: false, error: "A batch number is required." };
  const service = await svc();
  try {
    const { row } = await upsertBatch(service, {
      id: form.id,
      batchNumber: form.batchNumber.trim(),
      productId: form.productId ? form.productId : null,
    });
    revalidatePath("/inventory/batches");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export type BinForm = {
  id?: string;
  name: string;
  locationId?: string;
};

export async function saveBinAction(form: BinForm): Promise<Result> {
  if (!form.name?.trim()) return { ok: false, error: "A bin name is required." };
  const service = await svc();
  try {
    const { row } = await upsertBin(service, {
      id: form.id,
      name: form.name.trim(),
      locationId: form.locationId ? form.locationId : null,
    });
    revalidatePath("/inventory/bins");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
