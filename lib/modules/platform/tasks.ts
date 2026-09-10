import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, tasks, user } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";

type TaskRow = typeof tasks.$inferSelect;

/** Canonical task enums, shared by the UI, harness tools, and validation. */
export const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export function taskToApi(r: TaskRow) {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    status: r.status,
    priority: r.priority,
    assignee_id: r.assigneeId ?? null,
    due_datetime: datetime(r.dueAt),
    entity_type: r.entityType ?? null,
    entity_id: r.entityId ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

export async function listTasks(
  ctx: ServiceCtx,
  { limit, offset, status }: { limit?: number; offset?: number; status?: string } = {},
) {
  const lim = Math.min(500, Math.max(1, limit ?? 50));
  const off = Math.max(0, offset ?? 0);
  const filters = [eq(tasks.organizationId, ctx.orgId)];
  if (status) filters.push(eq(tasks.status, status));
  const where = and(...filters);
  const items = await db
    .select()
    .from(tasks)
    .where(where)
    .orderBy(desc(tasks.createdAt))
    .limit(lim)
    .offset(off);
  const [{ total }] = await db
    .select({ total: count() })
    .from(tasks)
    .where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getTask(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertTask(
  ctx: ServiceCtx,
  input: {
    id?: string;
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    dueAt?: Date | string | null;
    entityType?: string | null;
    entityId?: string | null;
  },
) {
  if (input.id) {
    const existing = await getTask(ctx, input.id);
    if (!existing) throw new Error("Task not found.");
    const changed: Partial<TaskRow> = {};
    if (input.title !== undefined) changed.title = input.title;
    if (input.description !== undefined) changed.description = input.description;
    if (input.status !== undefined) changed.status = input.status;
    if (input.priority !== undefined) changed.priority = input.priority;
    if (input.assigneeId !== undefined) changed.assigneeId = input.assigneeId;
    if (input.dueAt !== undefined) changed.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.entityType !== undefined) changed.entityType = input.entityType;
    if (input.entityId !== undefined) changed.entityId = input.entityId;
    const [row] = await db
      .update(tasks)
      .set({ ...changed, updatedAt: new Date() })
      .where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.title) {
    throw new Error("title is required.");
  }
  const [row] = await db
    .insert(tasks)
    .values({
      organizationId: ctx.orgId,
      title: input.title,
      description: input.description ?? null,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      assigneeId: input.assigneeId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })
    .returning();
  return { row, created: true };
}

/** Set a task's status directly (used by the board's quick actions + harness). */
export async function setTaskStatus(ctx: ServiceCtx, id: string, status: string) {
  const [row] = await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.id, id)))
    .returning();
  if (!row) throw new Error("Task not found.");
  return row;
}

export async function deleteTask(ctx: ServiceCtx, id: string) {
  await db.delete(tasks).where(and(eq(tasks.organizationId, ctx.orgId), eq(tasks.id, id)));
}

export type OrgMember = { id: string; name: string; email: string };

/** The org's members, for the assignee picker. */
export async function listOrgMembers(ctx: ServiceCtx): Promise<OrgMember[]> {
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.orgId))
    .orderBy(asc(user.name));
  return rows;
}
