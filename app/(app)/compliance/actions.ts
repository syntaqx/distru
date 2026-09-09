"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import { upsertLicense, upsertTestResult } from "@/lib/modules/compliance";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

/** Parse a YYYY-MM-DD (or empty) into a Date or null. */
function dateOrNull(v?: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export type LicenseForm = {
  id?: string;
  licenseNumber: string;
  licenseTypeId?: string;
  name?: string;
  state?: string;
  expiresAt?: string;
};

export async function saveLicenseAction(
  form: LicenseForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.licenseNumber?.trim())
    return { ok: false, error: "License number is required." };
  const service = await svc();
  try {
    const { row } = await upsertLicense(service, {
      id: form.id,
      licenseNumber: form.licenseNumber,
      licenseTypeId: form.licenseTypeId ? form.licenseTypeId : null,
      name: form.name?.trim() ? form.name.trim() : null,
      state: form.state?.trim() ? form.state.trim() : null,
      expiresAt: dateOrNull(form.expiresAt),
    });
    revalidatePath("/compliance");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export type TestResultForm = {
  id?: string;
  productId?: string;
  passed?: string;
  testedAt?: string;
  notes?: string;
};

export async function saveTestResultAction(
  form: TestResultForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const service = await svc();
  try {
    const results: Record<string, unknown> = {};
    if (form.notes?.trim()) results.notes = form.notes.trim();
    const { row } = await upsertTestResult(service, {
      id: form.id,
      productId: form.productId ? form.productId : null,
      passed: form.passed ? form.passed : null,
      testedAt: dateOrNull(form.testedAt),
      results,
    });
    revalidatePath("/compliance");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
