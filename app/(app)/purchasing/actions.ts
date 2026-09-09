"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  createPurchaseOrder,
  getPurchaseOrderByNumber,
  receivePurchaseOrder,
  setPurchaseOrderStatus,
  type PurchaseOrderStatus,
} from "@/lib/modules/purchasing";
import { findOrCreateVendor, getProductBySku } from "@/lib/modules/catalog";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

type Result = { ok: boolean; error?: string };

export type PoLineForm = {
  sku: string;
  quantity: number;
  unitCost?: number | null;
};

export async function createPurchaseOrderAction(form: {
  vendor: string;
  status: "DRAFT" | "OPEN" | "RECEIVED";
  lines: PoLineForm[];
}): Promise<Result & { number?: string }> {
  const service = await svc();
  if (!form.vendor?.trim())
    return { ok: false, error: "A vendor is required." };
  const clean = form.lines.filter(
    (l) => l.sku?.trim() && Number(l.quantity) > 0,
  );
  if (clean.length === 0)
    return { ok: false, error: "Add at least one line item." };

  const items = [];
  for (const line of clean) {
    const p = await getProductBySku(service, line.sku.trim());
    if (!p) return { ok: false, error: `Unknown SKU "${line.sku}".` };
    items.push({
      productId: p.product.id,
      sku: p.product.sku,
      name: p.product.name,
      quantity: line.quantity,
      unitCost: line.unitCost ?? 0,
    });
  }

  try {
    const vendor = await findOrCreateVendor(service, form.vendor);
    const po = await createPurchaseOrder(service, {
      vendorId: vendor.id,
      status: form.status,
      items,
    });
    revalidatePath("/purchasing");
    return { ok: true, number: po.purchaseOrder.poNumber };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create purchase order.",
    };
  }
}

export async function setPurchaseOrderStatusAction(
  poNumber: string,
  status: PurchaseOrderStatus,
): Promise<Result> {
  const service = await svc();
  const po = await getPurchaseOrderByNumber(service, poNumber);
  if (!po) return { ok: false, error: "Purchase order not found." };
  try {
    await setPurchaseOrderStatus(service, po.purchaseOrder.id, status);
    revalidatePath("/purchasing");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not update purchase order.",
    };
  }
}

export async function receivePurchaseOrderAction(
  poNumber: string,
): Promise<Result> {
  const service = await svc();
  const po = await getPurchaseOrderByNumber(service, poNumber);
  if (!po) return { ok: false, error: "Purchase order not found." };
  try {
    await receivePurchaseOrder(service, po.purchaseOrder.id);
    revalidatePath("/purchasing");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not receive purchase order.",
    };
  }
}
