import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customFields } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime } from "@/lib/modules/shared";

type CustomFieldRow = typeof customFields.$inferSelect;

export function customFieldToApi(r: CustomFieldRow) {
  return {
    id: r.id,
    entity_type: r.entityType,
    name: r.name,
    field_type: r.fieldType,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

export async function listCustomFields(
  ctx: ServiceCtx,
  { limit, offset }: { limit?: number; offset?: number } = {},
) {
  const lim = Math.min(200, Math.max(1, limit ?? 50));
  const off = Math.max(0, offset ?? 0);
  const items = await db
    .select()
    .from(customFields)
    .where(eq(customFields.organizationId, ctx.orgId))
    .orderBy(desc(customFields.createdAt))
    .limit(lim)
    .offset(off);
  const [{ total }] = await db
    .select({ total: count() })
    .from(customFields)
    .where(eq(customFields.organizationId, ctx.orgId));
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getCustomField(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(customFields)
    .where(and(eq(customFields.organizationId, ctx.orgId), eq(customFields.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertCustomField(
  ctx: ServiceCtx,
  input: { id?: string; entityType?: string; name?: string; fieldType?: string },
) {
  if (input.id) {
    const existing = await getCustomField(ctx, input.id);
    if (!existing) throw new Error("Custom field not found.");
    const changed: Partial<CustomFieldRow> = {};
    if (input.entityType !== undefined) changed.entityType = input.entityType;
    if (input.name !== undefined) changed.name = input.name;
    if (input.fieldType !== undefined) changed.fieldType = input.fieldType;
    const [row] = await db
      .update(customFields)
      .set({ ...changed, updatedAt: new Date() })
      .where(and(eq(customFields.organizationId, ctx.orgId), eq(customFields.id, input.id)))
      .returning();
    return { row, created: false };
  }
  if (!input.entityType || !input.name) {
    throw new Error("entity_type and name are required.");
  }
  const [row] = await db
    .insert(customFields)
    .values({
      organizationId: ctx.orgId,
      entityType: input.entityType,
      name: input.name,
      ...(input.fieldType !== undefined ? { fieldType: input.fieldType } : {}),
    })
    .returning();
  return { row, created: true };
}
