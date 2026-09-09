"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  createCompany,
  deleteCompany,
  updateCompany,
} from "@/lib/modules/catalog";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

export type CompanyForm = {
  id?: string;
  name: string;
  roles: string[];
  groupId?: string;
  tags?: string[];
};

export async function saveCompanyAction(
  form: CompanyForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.name?.trim()) return { ok: false, error: "Name is required." };
  if (!form.roles?.length)
    return { ok: false, error: "Pick at least one role." };
  const service = await svc();
  try {
    const groupId = form.groupId ? form.groupId : null;
    const tags = form.tags ?? [];
    let id: string;
    if (form.id) {
      const row = await updateCompany(service, form.id, {
        name: form.name,
        roles: form.roles,
        groupId,
        tags,
      });
      id = row.id;
    } else {
      const row = await createCompany(service, {
        name: form.name,
        roles: form.roles,
        groupId,
        tags,
      });
      id = row.id;
    }
    revalidatePath("/companies");
    revalidatePath(`/companies/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function deleteCompanyAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await deleteCompany(service, id);
    revalidatePath("/companies");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete company." };
  }
}
