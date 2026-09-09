import { and, count, desc, eq, gte, ilike, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, invoices, payments } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit, customData, datetime, num, ref } from "../shared";
import { getOrder, lineTotal, type OrderWithItems } from "./orders";
import { getAccountingProvider } from "@/lib/integrations/sync";

export type InvoiceStatus = "NOT_PAID" | "PARTIALLY_PAID" | "FULLY_PAID" | "OVER_PAID";
export type InvoiceRow = typeof invoices.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;

export type InvoiceWithRefs = {
  invoice: InvoiceRow;
  customer: { id: string; name: string } | null;
  /** The originating order, loaded so the invoice can embed its line items + charges (Distru shape). */
  order: OrderWithItems | null;
  payments: PaymentRow[];
};

/** Next per-org invoice number, e.g. INV-0001. */
export async function nextInvoiceNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(invoices)
    .where(eq(invoices.organizationId, ctx.orgId));
  return `INV-${String(Number(value) + 1).padStart(4, "0")}`;
}

/** Derive an invoice's payment status from its total and the amount settled. */
function deriveStatus(total: number, settled: number): InvoiceStatus {
  const eps = 1e-6;
  if (settled <= eps) return "NOT_PAID";
  if (settled > total + eps) return "OVER_PAID";
  if (settled >= total - eps) return "FULLY_PAID";
  return "PARTIALLY_PAID";
}

/** Create an invoice for an order, snapshotting its total at issue time. */
export async function createInvoiceForOrder(
  ctx: ServiceCtx,
  orderId: string,
  opts: { dueDate?: Date; notes?: string | null } = {},
) {
  const order = await getOrder(ctx, orderId);
  if (!order) throw new Error(`Order ${orderId} not found.`);
  const existing = await db
    .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(and(eq(invoices.organizationId, ctx.orgId), eq(invoices.orderId, orderId)))
    .limit(1);
  if (existing.length)
    throw new Error(`Order ${order.order.orderNumber} already has invoice ${existing[0].invoiceNumber}.`);

  const t = order.totals;
  const invoiceNumber = await nextInvoiceNumber(ctx);
  const [row] = await db
    .insert(invoices)
    .values({
      organizationId: ctx.orgId,
      invoiceNumber,
      orderId,
      customerId: order.order.customerId,
      status: "NOT_PAID",
      subtotal: String(t.subtotal),
      chargeTotal: String(t.chargeTotal),
      discountTotal: String(t.discountTotal),
      taxTotal: String(t.taxTotal),
      total: String(t.total),
      amountPaid: "0",
      dueDate: opts.dueDate ?? null,
      notes: opts.notes ?? null,
      billingAddress: order.order.billingAddress ?? null,
    })
    .returning();
  await recordAudit(ctx, {
    action: "invoice.create",
    entityType: "invoice",
    entityId: row.id,
    after: { invoiceNumber, orderNumber: order.order.orderNumber, total: t.total },
  });
  return (await getInvoice(ctx, row.id))!;
}

export async function getInvoice(ctx: ServiceCtx, id: string): Promise<InvoiceWithRefs | null> {
  const [row] = await db
    .select({ invoice: invoices, customer: { id: companies.id, name: companies.name } })
    .from(invoices)
    .leftJoin(companies, eq(invoices.customerId, companies.id))
    .where(and(eq(invoices.organizationId, ctx.orgId), eq(invoices.id, id)))
    .limit(1);
  if (!row) return null;
  const [pays, order] = await Promise.all([
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paidAt)),
    row.invoice.orderId ? getOrder(ctx, row.invoice.orderId) : Promise.resolve(null),
  ]);
  return {
    invoice: row.invoice,
    customer: row.customer?.id ? { id: row.customer.id, name: row.customer.name ?? "" } : null,
    order: order ?? null,
    payments: pays,
  };
}

export async function getInvoiceByNumber(ctx: ServiceCtx, invoiceNumber: string) {
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.organizationId, ctx.orgId), eq(invoices.invoiceNumber, invoiceNumber)))
    .limit(1);
  return row ? getInvoice(ctx, row.id) : null;
}

export type ListInvoicesArgs = {
  status?: InvoiceStatus;
  customerId?: string;
  search?: string;
  updatedFrom?: Date;
  updatedTo?: Date;
  limit?: number;
  offset?: number;
};

export async function listInvoices(ctx: ServiceCtx, args: ListInvoicesArgs = {}) {
  const filters: SQL[] = [eq(invoices.organizationId, ctx.orgId)];
  if (args.status) filters.push(eq(invoices.status, args.status));
  if (args.customerId) filters.push(eq(invoices.customerId, args.customerId));
  if (args.search) filters.push(ilike(invoices.invoiceNumber, `%${args.search}%`));
  if (args.updatedFrom) filters.push(gte(invoices.updatedAt, args.updatedFrom));
  if (args.updatedTo) filters.push(lte(invoices.updatedAt, args.updatedTo));
  const where = and(...filters);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);

  const rows = await db
    .select({ invoice: invoices, customer: { id: companies.id, name: companies.name } })
    .from(invoices)
    .leftJoin(companies, eq(invoices.customerId, companies.id))
    .where(where)
    .orderBy(desc(invoices.issueDate))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(invoices).where(where);
  return {
    items: rows.map((r) => ({
      invoice: r.invoice,
      customer: r.customer?.id ? { id: r.customer.id, name: r.customer.name ?? "" } : null,
    })),
    total: Number(total),
    limit,
    offset,
  };
}

/** Record a payment against an invoice and roll its status forward. */
export async function recordPayment(
  ctx: ServiceCtx,
  invoiceId: string,
  input: { amount: number; method?: string; reference?: string | null; paidAt?: Date },
) {
  const inv = await getInvoice(ctx, invoiceId);
  if (!inv) throw new Error(`Invoice ${invoiceId} not found.`);
  if (inv.invoice.voided) throw new Error("Cannot pay a voided invoice.");
  if (input.amount <= 0) throw new Error("Payment amount must be positive.");

  await db.insert(payments).values({
    organizationId: ctx.orgId,
    invoiceId,
    amount: String(input.amount),
    method: input.method ?? "cash",
    reference: input.reference ?? null,
    paidAt: input.paidAt ?? new Date(),
  });
  const paid = Number(inv.invoice.amountPaid) + input.amount;
  const settled = paid + Number(inv.invoice.creditsApplied);
  const status = deriveStatus(Number(inv.invoice.total), settled);
  await db
    .update(invoices)
    .set({ amountPaid: String(paid), status })
    .where(and(eq(invoices.organizationId, ctx.orgId), eq(invoices.id, invoiceId)));
  await recordAudit(ctx, {
    action: "payment.record",
    entityType: "invoice",
    entityId: invoiceId,
    after: { amount: input.amount, method: input.method ?? "cash", status },
  });
  return (await getInvoice(ctx, invoiceId))!;
}

export async function voidInvoice(ctx: ServiceCtx, id: string) {
  const inv = await getInvoice(ctx, id);
  if (!inv) throw new Error(`Invoice ${id} not found.`);
  await db
    .update(invoices)
    .set({ voided: true, voidedAt: new Date() })
    .where(and(eq(invoices.organizationId, ctx.orgId), eq(invoices.id, id)));
  await recordAudit(ctx, {
    action: "invoice.void",
    entityType: "invoice",
    entityId: id,
    before: { voided: inv.invoice.voided },
    after: { voided: true },
  });
  return (await getInvoice(ctx, id))!;
}

// ---------------- Payments as a standalone resource ----------------

export type PaymentWithInvoice = {
  payment: PaymentRow;
  invoiceNumber: string | null;
};

export async function listPayments(
  ctx: ServiceCtx,
  args: { invoiceId?: string; limit?: number; offset?: number } = {},
) {
  const filters: SQL[] = [eq(payments.organizationId, ctx.orgId)];
  if (args.invoiceId) filters.push(eq(payments.invoiceId, args.invoiceId));
  const where = and(...filters);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);
  const rows = await db
    .select({ payment: payments, invoiceNumber: invoices.invoiceNumber })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(where)
    .orderBy(desc(payments.paidAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(payments).where(where);
  return {
    items: rows.map((r) => ({ payment: r.payment, invoiceNumber: r.invoiceNumber ?? null })),
    total: Number(total),
    limit,
    offset,
  };
}

export async function getPayment(ctx: ServiceCtx, id: string): Promise<PaymentWithInvoice | null> {
  const [row] = await db
    .select({ payment: payments, invoiceNumber: invoices.invoiceNumber })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .where(and(eq(payments.organizationId, ctx.orgId), eq(payments.id, id)))
    .limit(1);
  return row ? { payment: row.payment, invoiceNumber: row.invoiceNumber ?? null } : null;
}

export function paymentToApi(p: PaymentWithInvoice) {
  const r = p.payment;
  return {
    id: r.id,
    invoice: r.invoiceId ? { id: r.invoiceId, invoice_number: p.invoiceNumber } : null,
    amount: num(r.amount),
    payment_method: r.method,
    payment_type: "SALE",
    status: "COMPLETED",
    reference: r.reference ?? null,
    payment_datetime: datetime(r.paidAt),
    // Distru-parity fields not modeled in this clone (null/empty; Tier 3).
    company: null,
    purchase: null,
    description: null,
    fully_paid_with_credits: false,
    credit_uses: [],
    overpayment_credits: [],
    quickbooks_deposit_account_id: getAccountingProvider().depositAccount()?.id ?? null,
    quickbooks_deposit_account_name: getAccountingProvider().depositAccount()?.name ?? null,
    quickbooks_sync_enqueued: false,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.createdAt),
  };
}

// ---------------- Distru-faithful API serialization ----------------

export function invoiceToApi(i: InvoiceWithRefs) {
  const r = i.invoice;
  const balance = Number(r.total) - Number(r.amountPaid) - Number(r.creditsApplied);
  return {
    id: r.id,
    invoice_number: r.invoiceNumber,
    status: r.status,
    payment_status: r.status,
    voided_datetime: r.voided ? datetime(r.voidedAt ?? r.updatedAt) : null,
    order: i.order ? { id: i.order.order.id, order_number: i.order.order.orderNumber } : null,
    company: ref(i.customer),
    invoice_datetime: datetime(r.issueDate),
    due_datetime: datetime(r.dueDate),
    subtotal: num(r.subtotal),
    charge_total: num(r.chargeTotal),
    discount_total: num(r.discountTotal),
    tax_total: num(r.taxTotal),
    total: num(r.total),
    paid_amount: num(r.amountPaid),
    credits_applied: num(r.creditsApplied),
    remaining_amount: num(balance),
    internal_notes: r.notes ?? null,
    external_notes: null,
    billing_location: (r.billingAddress as Record<string, unknown> | null) ?? null,
    tags: r.tags ?? [],
    custom_data: customData(r.customFields),
    items: (i.order?.items ?? []).map((it) => ({
      id: it.id,
      product: { id: it.productId, name: it.name, sku: it.sku ?? null },
      quantity: num(it.quantity),
      price: num(it.unitPrice),
      line_total: num(lineTotal(it)),
    })),
    charges: (i.order?.charges ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      amount: num(c.amount),
    })),
    payments: i.payments.map((p) => ({
      id: p.id,
      amount: num(p.amount),
      payment_method: p.method,
      reference: p.reference ?? null,
      payment_datetime: datetime(p.paidAt),
    })),
    // Distru-parity fields not modeled in this clone (null/empty; Tier 3).
    owner: null,
    creator: null,
    tasks: [],
    payment_term_name: null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
