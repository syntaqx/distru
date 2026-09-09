"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import { createReturn, getOrderByNumber } from "@/lib/modules/sales";
import { upsertCredit } from "@/lib/modules/sales";
import {
  findOrCreateCustomer,
  getProductBySku,
} from "@/lib/modules/catalog";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

type Result = { ok: boolean; error?: string };

export type ReturnLineForm = {
  sku: string;
  quantity: number;
  unitPrice?: number | null;
};

export async function createReturnAction(form: {
  customer: string;
  orderNumber?: string;
  reason?: string;
  lines: ReturnLineForm[];
}): Promise<Result & { returnNumber?: string }> {
  const service = await svc();
  if (!form.customer?.trim())
    return { ok: false, error: "A customer is required." };
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
      unitPrice: line.unitPrice ?? Number(p.product.unitPrice ?? 0),
    });
  }

  try {
    const customer = await findOrCreateCustomer(service, form.customer);
    let orderId: string | null = null;
    if (form.orderNumber?.trim()) {
      const order = await getOrderByNumber(service, form.orderNumber.trim());
      if (!order)
        return { ok: false, error: `Unknown order "${form.orderNumber}".` };
      orderId = order.order.id;
    }
    const ret = await createReturn(service, {
      customerId: customer.id,
      orderId,
      reason: form.reason?.trim() || null,
      items,
    });
    revalidatePath("/sales/returns");
    return { ok: true, returnNumber: ret.return.returnNumber };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create return.",
    };
  }
}

export async function saveCreditAction(form: {
  customer: string;
  amount: number;
  reason?: string;
}): Promise<Result & { id?: string }> {
  const service = await svc();
  if (!form.customer?.trim())
    return { ok: false, error: "A customer is required." };
  if (!(Number(form.amount) > 0))
    return { ok: false, error: "Amount must be greater than zero." };
  try {
    const customer = await findOrCreateCustomer(service, form.customer);
    const { row } = await upsertCredit(service, {
      customerId: customer.id,
      amount: Number(form.amount),
      reason: form.reason?.trim() || null,
    });
    revalidatePath("/sales/credits");
    return { ok: true, id: row.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not create credit.",
    };
  }
}
