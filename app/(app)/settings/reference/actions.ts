"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  createLocation,
  upsertCompanyGroup,
  upsertProductGroup,
  upsertProductSubcategory,
  upsertStrain,
  upsertTax,
} from "@/lib/modules/catalog";
import {
  upsertMenu,
  upsertPaymentMethod,
  upsertPaymentTerm,
  upsertPriceTier,
} from "@/lib/modules/sales";

export type SaveResult = { ok: boolean; error?: string; id?: string };

const PATH = "/settings/reference";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

function fail(e: unknown): SaveResult {
  return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
}

// ---- Taxes: name + rate (percent) ----
export async function saveTaxAction(input: { name: string; rate?: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const rate = input.rate?.trim();
  if (rate && Number.isNaN(Number(rate))) return { ok: false, error: "Rate must be a number." };
  try {
    const { row } = await upsertTax(await svc(), { name, rate: rate ? rate : undefined });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Price tiers: name ----
export async function savePriceTierAction(input: { name: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  try {
    const { row } = await upsertPriceTier(await svc(), { name });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Payment terms: name + net days ----
export async function savePaymentTermAction(input: {
  name: string;
  netDays?: string;
}): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const raw = input.netDays?.trim();
  let netDays: number | undefined;
  if (raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: "Net days must be a whole number." };
    netDays = n;
  }
  try {
    const { row } = await upsertPaymentTerm(await svc(), { name, netDays });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Payment methods: name ----
export async function savePaymentMethodAction(input: { name: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  try {
    const { row } = await upsertPaymentMethod(await svc(), { name });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Strains: name + type ----
export async function saveStrainAction(input: { name: string; type?: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const type = input.type?.trim();
  try {
    const { row } = await upsertStrain(await svc(), { name, type: type ? type : null });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Product subcategories: name ----
export async function saveProductSubcategoryAction(input: { name: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  try {
    const { row } = await upsertProductSubcategory(await svc(), { name });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Product groups: name ----
export async function saveProductGroupAction(input: { name: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  try {
    const { row } = await upsertProductGroup(await svc(), { name });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Company groups: name ----
export async function saveCompanyGroupAction(input: { name: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  try {
    const { row } = await upsertCompanyGroup(await svc(), { name });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Menus: name ----
export async function saveMenuAction(input: { name: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  try {
    const { row } = await upsertMenu(await svc(), { name });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

// ---- Locations: name (create-only; no upsert) ----
export async function saveLocationAction(input: { name: string }): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name is required." };
  try {
    const row = await createLocation(await svc(), { name });
    revalidatePath(PATH);
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}
