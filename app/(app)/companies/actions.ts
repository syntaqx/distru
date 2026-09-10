"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  addCompanyNote,
  createCompany,
  deleteCompany,
  deleteCompanyNote,
  updateCompany,
  upsertContact,
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

// ---------------- Sales notes / activity timeline ----------------

export async function addCompanyNoteAction(
  companyId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!body?.trim()) return { ok: false, error: "Note cannot be empty." };
  const service = await svc();
  try {
    await addCompanyNote(service, { companyId, body });
    revalidatePath(`/companies/${companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add note." };
  }
}

export async function deleteCompanyNoteAction(
  companyId: string,
  noteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await deleteCompanyNote(service, noteId);
    revalidatePath(`/companies/${companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete note." };
  }
}

// ---------------- Contacts (per company) ----------------

export type ContactForm = {
  id?: string;
  companyId: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
};

export async function saveContactAction(
  form: ContactForm,
): Promise<{ ok: boolean; error?: string }> {
  if (!form.name?.trim()) return { ok: false, error: "Contact name is required." };
  const service = await svc();
  try {
    await upsertContact(service, {
      id: form.id,
      companyId: form.companyId,
      name: form.name,
      title: form.title ?? null,
      email: form.email ?? null,
      phone: form.phone ?? null,
    });
    revalidatePath(`/companies/${form.companyId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save contact." };
  }
}
