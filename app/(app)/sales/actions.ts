"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  cancelOrder,
  createOrder,
  getOrderByNumber,
  setOrderStatus,
  type OrderStatus,
} from "@/lib/modules/sales";
import {
  createInvoiceForOrder,
  getInvoiceByNumber,
  recordPayment,
} from "@/lib/modules/sales";
import { getProductBySku } from "@/lib/modules/catalog";
import { findOrCreateCustomer } from "@/lib/modules/catalog";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

type Result = { ok: boolean; error?: string };

export type OrderLineForm = { sku: string; quantity: number; unitPrice?: number | null };

export async function createOrderAction(form: {
  customer: string;
  status: "PENDING" | "PROCESSING";
  lines: OrderLineForm[];
}): Promise<Result & { orderNumber?: string }> {
  const service = await svc();
  if (!form.customer?.trim()) return { ok: false, error: "A customer is required." };
  const clean = form.lines.filter((l) => l.sku?.trim() && Number(l.quantity) > 0);
  if (clean.length === 0) return { ok: false, error: "Add at least one line item." };

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
    const order = await createOrder(service, {
      customerId: customer.id,
      status: form.status,
      items,
    });
    revalidatePath("/sales");
    return { ok: true, orderNumber: order.order.orderNumber };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create order." };
  }
}

export async function setOrderStatusAction(
  orderNumber: string,
  status: OrderStatus,
): Promise<Result> {
  const service = await svc();
  const order = await getOrderByNumber(service, orderNumber);
  if (!order) return { ok: false, error: "Order not found." };
  try {
    await setOrderStatus(service, order.order.id, status);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update order." };
  }
}

export async function cancelOrderAction(orderNumber: string): Promise<Result> {
  const service = await svc();
  const order = await getOrderByNumber(service, orderNumber);
  if (!order) return { ok: false, error: "Order not found." };
  try {
    await cancelOrder(service, order.order.id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not cancel order." };
  }
}

export async function createInvoiceAction(orderNumber: string): Promise<Result> {
  const service = await svc();
  const order = await getOrderByNumber(service, orderNumber);
  if (!order) return { ok: false, error: "Order not found." };
  try {
    await createInvoiceForOrder(service, order.order.id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create invoice." };
  }
}

export async function recordPaymentAction(
  invoiceNumber: string,
  amount: number,
  method?: string,
): Promise<Result> {
  const service = await svc();
  const inv = await getInvoiceByNumber(service, invoiceNumber);
  if (!inv) return { ok: false, error: "Invoice not found." };
  try {
    await recordPayment(service, inv.invoice.id, { amount, method });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not record payment." };
  }
}
