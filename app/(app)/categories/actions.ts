"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/modules/catalog";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

export type CategoryForm = {
  id?: string;
  name: string;
  biotrackType?: string | null;
};

export async function saveCategoryAction(
  form: CategoryForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.name?.trim()) return { ok: false, error: "Name is required." };
  const service = await svc();
  try {
    const category = form.id
      ? await updateCategory(service, form.id, {
          name: form.name,
          biotrackType: form.biotrackType || null,
        })
      : await createCategory(service, {
          name: form.name,
          biotrackType: form.biotrackType || null,
        });
    revalidatePath("/categories");
    revalidatePath("/inventory");
    return { ok: true, id: category.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function deleteCategoryAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await deleteCategory(service, id);
    revalidatePath("/categories");
    revalidatePath("/inventory");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete category." };
  }
}
