/**
 * Sales configuration / reference resources: payment methods, payment terms,
 * price tiers, charge presets, menus, and customer credits. Each is a small,
 * org-scoped list-and-upsert resource backing the order/invoice workflow.
 */
import { db } from "@/db";
import {
  paymentMethods,
  paymentTerms,
  priceTiers,
  chargePresets,
  menus,
  credits,
} from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, num } from "@/lib/modules/shared";
import { and, asc, count, desc, eq } from "drizzle-orm";

export type ListArgs = { limit?: number; offset?: number };

function clampLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 50, 1), 200);
}

function clampOffset(offset?: number) {
  return Math.max(offset ?? 0, 0);
}

// ---------------- Payment methods ----------------

export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
export type PaymentMethodInput = { id?: string; name?: string };

export async function listPaymentMethods(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(paymentMethods.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(paymentMethods)
    .where(where)
    .orderBy(asc(paymentMethods.name))
    .limit(lim)
    .offset(off);
  const [{ value: total }] = await db.select({ value: count() }).from(paymentMethods).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getPaymentMethod(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.organizationId, ctx.orgId), eq(paymentMethods.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertPaymentMethod(ctx: ServiceCtx, input: PaymentMethodInput) {
  if (input.id) {
    const existing = await getPaymentMethod(ctx, input.id);
    if (!existing) throw new Error("Payment method not found.");
    const set: Partial<typeof paymentMethods.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    const [row] = await db
      .update(paymentMethods)
      .set(set)
      .where(and(eq(paymentMethods.organizationId, ctx.orgId), eq(paymentMethods.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(paymentMethods)
    .values({ organizationId: ctx.orgId, name: input.name })
    .returning();
  return { row, created: true };
}

export function paymentMethodToApi(r: PaymentMethodRow) {
  return {
    id: r.id,
    name: r.name,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Payment terms ----------------

export type PaymentTermRow = typeof paymentTerms.$inferSelect;
export type PaymentTermInput = { id?: string; name?: string; netDays?: number };

export async function listPaymentTerms(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(paymentTerms.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(paymentTerms)
    .where(where)
    .orderBy(asc(paymentTerms.name))
    .limit(lim)
    .offset(off);
  const [{ value: total }] = await db.select({ value: count() }).from(paymentTerms).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getPaymentTerm(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(paymentTerms)
    .where(and(eq(paymentTerms.organizationId, ctx.orgId), eq(paymentTerms.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertPaymentTerm(ctx: ServiceCtx, input: PaymentTermInput) {
  if (input.id) {
    const existing = await getPaymentTerm(ctx, input.id);
    if (!existing) throw new Error("Payment term not found.");
    const set: Partial<typeof paymentTerms.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    if (input.netDays !== undefined) set.netDays = String(input.netDays);
    const [row] = await db
      .update(paymentTerms)
      .set(set)
      .where(and(eq(paymentTerms.organizationId, ctx.orgId), eq(paymentTerms.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(paymentTerms)
    .values({
      organizationId: ctx.orgId,
      name: input.name,
      ...(input.netDays !== undefined ? { netDays: String(input.netDays) } : {}),
    })
    .returning();
  return { row, created: true };
}

export function paymentTermToApi(r: PaymentTermRow) {
  return {
    id: r.id,
    name: r.name,
    net_days: num(r.netDays),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Price tiers ----------------

export type PriceTierRow = typeof priceTiers.$inferSelect;
export type PriceTierInput = { id?: string; name?: string };

export async function listPriceTiers(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(priceTiers.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(priceTiers)
    .where(where)
    .orderBy(asc(priceTiers.name))
    .limit(lim)
    .offset(off);
  const [{ value: total }] = await db.select({ value: count() }).from(priceTiers).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getPriceTier(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(priceTiers)
    .where(and(eq(priceTiers.organizationId, ctx.orgId), eq(priceTiers.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertPriceTier(ctx: ServiceCtx, input: PriceTierInput) {
  if (input.id) {
    const existing = await getPriceTier(ctx, input.id);
    if (!existing) throw new Error("Price tier not found.");
    const set: Partial<typeof priceTiers.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    const [row] = await db
      .update(priceTiers)
      .set(set)
      .where(and(eq(priceTiers.organizationId, ctx.orgId), eq(priceTiers.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(priceTiers)
    .values({ organizationId: ctx.orgId, name: input.name })
    .returning();
  return { row, created: true };
}

export function priceTierToApi(r: PriceTierRow) {
  return {
    id: r.id,
    name: r.name,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Charge presets ----------------

export type ChargePresetRow = typeof chargePresets.$inferSelect;
export type ChargePresetInput = { id?: string; name?: string; kind?: string; amount?: number };

export async function listChargePresets(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(chargePresets.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(chargePresets)
    .where(where)
    .orderBy(asc(chargePresets.name))
    .limit(lim)
    .offset(off);
  const [{ value: total }] = await db.select({ value: count() }).from(chargePresets).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getChargePreset(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(chargePresets)
    .where(and(eq(chargePresets.organizationId, ctx.orgId), eq(chargePresets.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertChargePreset(ctx: ServiceCtx, input: ChargePresetInput) {
  if (input.id) {
    const existing = await getChargePreset(ctx, input.id);
    if (!existing) throw new Error("Charge preset not found.");
    const set: Partial<typeof chargePresets.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    if (input.kind !== undefined) set.kind = input.kind as typeof chargePresets.$inferInsert.kind;
    if (input.amount !== undefined) set.amount = String(input.amount);
    const [row] = await db
      .update(chargePresets)
      .set(set)
      .where(and(eq(chargePresets.organizationId, ctx.orgId), eq(chargePresets.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(chargePresets)
    .values({
      organizationId: ctx.orgId,
      name: input.name,
      ...(input.kind !== undefined
        ? { kind: input.kind as typeof chargePresets.$inferInsert.kind }
        : {}),
      ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
    })
    .returning();
  return { row, created: true };
}

export function chargePresetToApi(r: ChargePresetRow) {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    amount: num(r.amount),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Menus ----------------

export type MenuRow = typeof menus.$inferSelect;
export type MenuInput = { id?: string; name?: string; priceTierId?: string | null; published?: string };

export async function listMenus(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(menus.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(menus)
    .where(where)
    .orderBy(asc(menus.name))
    .limit(lim)
    .offset(off);
  const [{ value: total }] = await db.select({ value: count() }).from(menus).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getMenu(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(menus)
    .where(and(eq(menus.organizationId, ctx.orgId), eq(menus.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertMenu(ctx: ServiceCtx, input: MenuInput) {
  if (input.id) {
    const existing = await getMenu(ctx, input.id);
    if (!existing) throw new Error("Menu not found.");
    const set: Partial<typeof menus.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    if (input.priceTierId !== undefined) set.priceTierId = input.priceTierId;
    if (input.published !== undefined) set.published = input.published;
    const [row] = await db
      .update(menus)
      .set(set)
      .where(and(eq(menus.organizationId, ctx.orgId), eq(menus.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(menus)
    .values({
      organizationId: ctx.orgId,
      name: input.name,
      ...(input.priceTierId !== undefined ? { priceTierId: input.priceTierId } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    })
    .returning();
  return { row, created: true };
}

export function menuToApi(r: MenuRow) {
  return {
    id: r.id,
    name: r.name,
    price_tier_id: r.priceTierId ?? null,
    published: r.published,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Credits ----------------

export type CreditRow = typeof credits.$inferSelect;
export type CreditInput = {
  id?: string;
  customerId?: string | null;
  amount?: number;
  remaining?: number;
  reason?: string | null;
};

export async function listCredits(ctx: ServiceCtx, { limit, offset }: ListArgs = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const where = eq(credits.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(credits)
    .where(where)
    .orderBy(desc(credits.createdAt))
    .limit(lim)
    .offset(off);
  const [{ value: total }] = await db.select({ value: count() }).from(credits).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getCredit(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(credits)
    .where(and(eq(credits.organizationId, ctx.orgId), eq(credits.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertCredit(ctx: ServiceCtx, input: CreditInput) {
  if (input.id) {
    const existing = await getCredit(ctx, input.id);
    if (!existing) throw new Error("Credit not found.");
    const set: Partial<typeof credits.$inferInsert> = { updatedAt: new Date() };
    if (input.customerId !== undefined) set.customerId = input.customerId;
    if (input.amount !== undefined) set.amount = String(input.amount);
    if (input.remaining !== undefined) set.remaining = String(input.remaining);
    if (input.reason !== undefined) set.reason = input.reason;
    const [row] = await db
      .update(credits)
      .set(set)
      .where(and(eq(credits.organizationId, ctx.orgId), eq(credits.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (typeof input.amount !== "number") throw new Error("amount is required.");
  const [row] = await db
    .insert(credits)
    .values({
      organizationId: ctx.orgId,
      customerId: input.customerId ?? null,
      amount: String(input.amount),
      remaining: String(input.remaining ?? input.amount),
      reason: input.reason ?? null,
    })
    .returning();
  return { row, created: true };
}

export function creditToApi(r: CreditRow) {
  return {
    id: r.id,
    customer_id: r.customerId ?? null,
    amount: num(r.amount),
    remaining: num(r.remaining),
    reason: r.reason ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
