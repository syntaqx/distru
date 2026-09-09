import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fileAttachments } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";

type FileAttachmentRow = typeof fileAttachments.$inferSelect;

export function fileAttachmentToApi(r: FileAttachmentRow) {
  return {
    id: r.id,
    entity_type: r.entityType,
    entity_id: r.entityId ?? null,
    filename: r.filename,
    url: r.url ?? null,
    content_type: r.contentType ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

export async function listFileAttachments(
  ctx: ServiceCtx,
  { limit, offset }: { limit?: number; offset?: number } = {},
) {
  const lim = Math.min(200, Math.max(1, limit ?? 50));
  const off = Math.max(0, offset ?? 0);
  const items = await db
    .select()
    .from(fileAttachments)
    .where(eq(fileAttachments.organizationId, ctx.orgId))
    .orderBy(desc(fileAttachments.createdAt))
    .limit(lim)
    .offset(off);
  const [{ total }] = await db
    .select({ total: count() })
    .from(fileAttachments)
    .where(eq(fileAttachments.organizationId, ctx.orgId));
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getFileAttachment(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(fileAttachments)
    .where(and(eq(fileAttachments.organizationId, ctx.orgId), eq(fileAttachments.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertFileAttachment(
  ctx: ServiceCtx,
  input: {
    id?: string;
    entityType?: string;
    entityId?: string | null;
    filename?: string;
    url?: string | null;
    contentType?: string | null;
  },
) {
  if (input.id) {
    const existing = await getFileAttachment(ctx, input.id);
    if (!existing) throw new Error("File attachment not found.");
    const changed: Partial<FileAttachmentRow> = {};
    if (input.entityType !== undefined) changed.entityType = input.entityType;
    if (input.entityId !== undefined) changed.entityId = input.entityId;
    if (input.filename !== undefined) changed.filename = input.filename;
    if (input.url !== undefined) changed.url = input.url;
    if (input.contentType !== undefined) changed.contentType = input.contentType;
    const [row] = await db
      .update(fileAttachments)
      .set({ ...changed, updatedAt: new Date() })
      .where(and(eq(fileAttachments.organizationId, ctx.orgId), eq(fileAttachments.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.filename) {
    throw new Error("filename is required.");
  }
  const [row] = await db
    .insert(fileAttachments)
    .values({
      organizationId: ctx.orgId,
      entityType: input.entityType ?? "",
      entityId: input.entityId ?? null,
      filename: input.filename,
      url: input.url ?? null,
      contentType: input.contentType ?? null,
    })
    .returning();
  return { row, created: true };
}
