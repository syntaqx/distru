/**
 * Catalog depth - the org-scoped reference tables that give products their
 * finer classification (strains, sub-categories, groups, tags, taxes) plus the
 * global, read-only official product category taxonomy. Import from the catalog
 * barrel, never from this file directly.
 *
 * Depends on: shared.
 */
import { db } from "@/db";
import {
  strains,
  productSubcategories,
  productGroups,
  tags,
  taxes,
  officialProductCategories,
} from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, num } from "@/lib/modules/shared";
import { and, asc, count, eq } from "drizzle-orm";

type ListOptions = { limit?: number; offset?: number };

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), 200);
}

function clampOffset(offset: number | undefined): number {
  return Math.max(offset ?? 0, 0);
}

// ---------------- Strains ----------------

export type StrainRow = typeof strains.$inferSelect;

export async function listStrains(ctx: ServiceCtx, o: ListOptions = {}) {
  const limit = clampLimit(o.limit);
  const offset = clampOffset(o.offset);
  const where = eq(strains.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(strains)
    .where(where)
    .orderBy(asc(strains.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(strains).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getStrain(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(strains)
    .where(and(eq(strains.organizationId, ctx.orgId), eq(strains.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertStrain(
  ctx: ServiceCtx,
  input: { id?: string; name?: string; type?: string | null },
) {
  if (input.id) {
    const [row] = await db
      .update(strains)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(strains.organizationId, ctx.orgId), eq(strains.id, input.id)))
      .returning();
    if (!row) throw new Error("Strain not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(strains)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      type: input.type ?? null,
    })
    .returning();
  return { row, created: true };
}

export function strainToApi(r: StrainRow) {
  return {
    id: r.id,
    name: r.name,
    type: r.type ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Product subcategories ----------------

export type ProductSubcategoryRow = typeof productSubcategories.$inferSelect;

export async function listProductSubcategories(ctx: ServiceCtx, o: ListOptions = {}) {
  const limit = clampLimit(o.limit);
  const offset = clampOffset(o.offset);
  const where = eq(productSubcategories.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(productSubcategories)
    .where(where)
    .orderBy(asc(productSubcategories.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(productSubcategories)
    .where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getProductSubcategory(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(productSubcategories)
    .where(
      and(
        eq(productSubcategories.organizationId, ctx.orgId),
        eq(productSubcategories.id, id),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertProductSubcategory(
  ctx: ServiceCtx,
  input: { id?: string; name?: string; categoryId?: string | null },
) {
  if (input.id) {
    const [row] = await db
      .update(productSubcategories)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productSubcategories.organizationId, ctx.orgId),
          eq(productSubcategories.id, input.id),
        ),
      )
      .returning();
    if (!row) throw new Error("Product subcategory not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(productSubcategories)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      categoryId: input.categoryId ?? null,
    })
    .returning();
  return { row, created: true };
}

export function productSubcategoryToApi(r: ProductSubcategoryRow) {
  return {
    id: r.id,
    name: r.name,
    category_id: r.categoryId ?? null,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Product groups ----------------

export type ProductGroupRow = typeof productGroups.$inferSelect;

export async function listProductGroups(ctx: ServiceCtx, o: ListOptions = {}) {
  const limit = clampLimit(o.limit);
  const offset = clampOffset(o.offset);
  const where = eq(productGroups.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(productGroups)
    .where(where)
    .orderBy(asc(productGroups.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(productGroups)
    .where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getProductGroup(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(productGroups)
    .where(and(eq(productGroups.organizationId, ctx.orgId), eq(productGroups.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertProductGroup(
  ctx: ServiceCtx,
  input: { id?: string; name?: string },
) {
  if (input.id) {
    const [row] = await db
      .update(productGroups)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(productGroups.organizationId, ctx.orgId), eq(productGroups.id, input.id)))
      .returning();
    if (!row) throw new Error("Product group not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(productGroups)
    .values({ organizationId: ctx.orgId, name: input.name.trim() })
    .returning();
  return { row, created: true };
}

export function productGroupToApi(r: ProductGroupRow) {
  return {
    id: r.id,
    name: r.name,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Tags ----------------

export type TagRow = typeof tags.$inferSelect;

export async function listTags(ctx: ServiceCtx, o: ListOptions = {}) {
  const limit = clampLimit(o.limit);
  const offset = clampOffset(o.offset);
  const where = eq(tags.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(tags)
    .where(where)
    .orderBy(asc(tags.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(tags).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getTag(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.organizationId, ctx.orgId), eq(tags.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertTag(
  ctx: ServiceCtx,
  input: { id?: string; name?: string },
) {
  if (input.id) {
    const [row] = await db
      .update(tags)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(tags.organizationId, ctx.orgId), eq(tags.id, input.id)))
      .returning();
    if (!row) throw new Error("Tag not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(tags)
    .values({ organizationId: ctx.orgId, name: input.name.trim() })
    .returning();
  return { row, created: true };
}

export function tagToApi(r: TagRow) {
  return {
    id: r.id,
    name: r.name,
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Taxes ----------------

export type TaxRow = typeof taxes.$inferSelect;

export async function listTaxes(ctx: ServiceCtx, o: ListOptions = {}) {
  const limit = clampLimit(o.limit);
  const offset = clampOffset(o.offset);
  const where = eq(taxes.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(taxes)
    .where(where)
    .orderBy(asc(taxes.name))
    .limit(limit)
    .offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(taxes).where(where);
  return { items, total: Number(total), limit, offset };
}

export async function getTax(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(taxes)
    .where(and(eq(taxes.organizationId, ctx.orgId), eq(taxes.id, id)))
    .limit(1);
  return row ?? null;
}

export async function upsertTax(
  ctx: ServiceCtx,
  input: { id?: string; name?: string; rate?: string | number | null },
) {
  if (input.id) {
    const [row] = await db
      .update(taxes)
      .set({
        ...(input.name != null ? { name: input.name.trim() } : {}),
        ...(input.rate !== undefined && input.rate !== null
          ? { rate: String(input.rate) }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(taxes.organizationId, ctx.orgId), eq(taxes.id, input.id)))
      .returning();
    if (!row) throw new Error("Tax not found.");
    return { row, created: false };
  }
  if (!input.name) throw new Error("name is required.");
  const [row] = await db
    .insert(taxes)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      ...(input.rate !== undefined && input.rate !== null ? { rate: String(input.rate) } : {}),
    })
    .returning();
  return { row, created: true };
}

export function taxToApi(r: TaxRow) {
  return {
    id: r.id,
    name: r.name,
    rate: num(r.rate),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Official product categories (global, read-only) ----------------

export type OfficialProductCategoryRow = typeof officialProductCategories.$inferSelect;

export async function listOfficialProductCategories() {
  return db.select().from(officialProductCategories).orderBy(asc(officialProductCategories.name));
}

export function officialProductCategoryToApi(r: OfficialProductCategoryRow) {
  return { id: r.id, name: r.name };
}
