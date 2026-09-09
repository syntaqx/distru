import { and, desc, eq, inArray, or, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";

export type NotificationRow = typeof notifications.$inferSelect;

export async function createNotification(
  ctx: ServiceCtx,
  input: { userId?: string | null; kind: string; title: string; body?: string | null; href?: string | null },
): Promise<NotificationRow> {
  const [row] = await db
    .insert(notifications)
    .values({
      organizationId: ctx.orgId,
      userId: input.userId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
    })
    .returning();
  return row;
}

/** Notifications visible to a user: org-wide (userId null) plus their own. */
function visibleTo(ctx: ServiceCtx, userId: string | null) {
  return and(
    eq(notifications.organizationId, ctx.orgId),
    userId ? or(isNull(notifications.userId), eq(notifications.userId, userId)) : undefined,
  );
}

export async function listNotifications(
  ctx: ServiceCtx,
  userId: string | null,
  limit = 30,
): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notifications)
    .where(visibleTo(ctx, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(ctx: ServiceCtx, userId: string | null): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(visibleTo(ctx, userId), eq(notifications.read, false)));
  return row?.n ?? 0;
}

export async function markRead(
  ctx: ServiceCtx,
  userId: string | null,
  opts: { ids?: string[]; all?: boolean },
): Promise<void> {
  if (opts.all) {
    await db.update(notifications).set({ read: true }).where(visibleTo(ctx, userId));
    return;
  }
  if (opts.ids && opts.ids.length) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.organizationId, ctx.orgId), inArray(notifications.id, opts.ids)));
  }
}
