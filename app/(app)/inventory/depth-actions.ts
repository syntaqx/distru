"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  upsertPackage,
  upsertBatch,
  upsertBin,
  createTransfer,
  scanCode,
  getOnHand,
} from "@/lib/modules/inventory";

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

export type TransferLineForm = { productId: string; quantity: string };

export type TransferForm = {
  fromLocationId: string;
  toLocationId: string;
  notes?: string;
  lines: TransferLineForm[];
};

export async function createTransferAction(form: TransferForm): Promise<Result> {
  if (!form.fromLocationId) return { ok: false, error: "Pick a source location." };
  if (!form.toLocationId) return { ok: false, error: "Pick a destination location." };
  if (form.fromLocationId === form.toLocationId)
    return { ok: false, error: "Source and destination locations must differ." };

  const lines = form.lines.filter((l) => l.productId && Number(l.quantity) > 0);
  if (lines.length === 0) return { ok: false, error: "Add at least one line." };

  const service = await svc();
  try {
    const transfer = await createTransfer(service, {
      fromLocationId: form.fromLocationId,
      toLocationId: form.toLocationId,
      notes: form.notes?.trim() ? form.notes.trim() : null,
      lines: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
    });
    revalidatePath("/inventory/transfers");
    revalidatePath("/inventory/valuation");
    return { ok: true, id: transfer.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Transfer failed." };
  }
}

export type ScanHit =
  | {
      kind: "package";
      title: string;
      subtitle: string | null;
      quantity: number;
      status: string;
    }
  | { kind: "product"; title: string; subtitle: string | null; onHand: number };

export async function scanCodeAction(
  code: string,
): Promise<{ ok: boolean; hit?: ScanHit | null; error?: string }> {
  if (!code?.trim()) return { ok: false, error: "Enter a code to scan." };
  const service = await svc();
  try {
    const result = await scanCode(service, code);
    if (!result) return { ok: true, hit: null };
    if (result.kind === "package") {
      const p = result.package;
      return {
        ok: true,
        hit: {
          kind: "package",
          title: p.packageTag,
          subtitle: null,
          quantity: Number(p.quantity),
          status: p.status,
        },
      };
    }
    const onHand = await getOnHand(service, result.product.id);
    return {
      ok: true,
      hit: {
        kind: "product",
        title: result.product.name,
        subtitle: result.product.sku ?? null,
        onHand: Number(onHand),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Scan failed." };
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
