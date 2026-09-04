import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import type { ServiceCtx } from "./context";

/** Recent audit entries for the org (dashboard activity feed). */
export async function listRecentAudit(ctx: ServiceCtx, limit = 12) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.organizationId, ctx.orgId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/** Append a row to the cross-face audit trail. Never throws into the caller. */
export async function recordAudit(
  ctx: ServiceCtx,
  entry: {
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) {
  try {
    await db.insert(auditLog).values({
      organizationId: ctx.orgId,
      actorType: ctx.actorType,
      actorId: ctx.actor,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to record", entry.action, err);
  }
}
