import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";

type TaskRow = typeof tasks.$inferSelect;

export function taskToApi(r: TaskRow) {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
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
  { limit, offset }: { limit?: number; offset?: number } = {},
) {
  const lim = Math.min(200, Math.max(1, limit ?? 50));
  const off = Math.max(0, offset ?? 0);
  const items = await db
    .select()
    .from(tasks)
    .where(eq(tasks.organizationId, ctx.orgId))
    .orderBy(desc(tasks.createdAt))
    .limit(lim)
    .offset(off);
  const [{ total }] = await db
    .select({ total: count() })
    .from(tasks)
    .where(eq(tasks.organizationId, ctx.orgId));
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
    status?: string;
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
    if (input.status !== undefined) changed.status = input.status;
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
      ...(input.status !== undefined ? { status: input.status } : {}),
      assigneeId: input.assigneeId ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })
    .returning();
  return { row, created: true };
}
