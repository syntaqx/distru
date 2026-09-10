"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import { deleteTask, setTaskStatus, upsertTask } from "@/lib/modules/platform";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

export type TaskForm = {
  id?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueAt?: string | null;
  assigneeId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export async function saveTaskAction(
  form: TaskForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!form.title?.trim()) return { ok: false, error: "Title is required." };
  const service = await svc();
  try {
    const { row } = await upsertTask(service, {
      id: form.id,
      title: form.title.trim(),
      description: form.description?.trim() ? form.description.trim() : null,
      status: form.status,
      priority: form.priority,
      dueAt: form.dueAt ? form.dueAt : null,
      assigneeId: form.assigneeId ? form.assigneeId : null,
      entityType: form.entityType ? form.entityType : null,
      entityId: form.entityId ? form.entityId : null,
    });
    revalidatePath("/tasks");
    return { ok: true, id: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function setTaskStatusAction(
  id: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await setTaskStatus(service, id, status);
    revalidatePath("/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update task." };
  }
}

export async function deleteTaskAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await deleteTask(service, id);
    revalidatePath("/tasks");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete task." };
  }
}
