import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories, companies, products, unitTypes } from "@/db/schema";
import type { ServiceCtx } from "./context";
import { recordAudit } from "./audit";
import { datetime, num, ref } from "./serialize";

export type ProductRow = typeof products.$inferSelect;

export type ProductWithRefs = {
  product: ProductRow;
  category: { id: string; name: string } | null;
  vendor: { id: string; name: string } | null;
  unitType: { id: string; name: string } | null;
  servingUnitType: { id: string; name: string } | null;
};

/** Sparse upsert input, mirroring Distru: omit id to create, include to update. */
export type ProductInput = {
  id?: string;
  sku?: string;
  name?: string;
  inventoryTrackingMethod?: "PACKAGE" | "PRODUCT" | "BATCH";
  categoryId?: string | null;
  vendorId?: string | null;
  unitTypeId?: string | null;
  unitPrice?: string | number | null;
  netQuantityPerUnit?: string | number | null;
  servingUnitTypeId?: string | null;
  servingSize?: string | number | null;
  description?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
  status?: "ACTIVE" | "ARCHIVED";
};

const servingUnit = alias(unitTypes, "serving_unit");

function selectShape() {
  return {
    product: products,
    category: { id: categories.id, name: categories.name },
    vendor: { id: companies.id, name: companies.name },
    unitType: { id: unitTypes.id, name: unitTypes.name },
    servingUnitType: { id: servingUnit.id, name: servingUnit.name },
  };
}

function baseQuery() {
  return db
    .select(selectShape())
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(companies, eq(products.vendorId, companies.id))
    .leftJoin(unitTypes, eq(products.unitTypeId, unitTypes.id))
    .leftJoin(servingUnit, eq(products.servingUnitTypeId, servingUnit.id));
}

function shape(row: {
  product: ProductRow;
  category: { id: string | null; name: string | null } | null;
  vendor: { id: string | null; name: string | null } | null;
  unitType: { id: string | null; name: string | null } | null;
  servingUnitType: { id: string | null; name: string | null } | null;
}): ProductWithRefs {
  const nz = (r: { id: string | null; name: string | null } | null) =>
    r && r.id ? { id: r.id, name: r.name ?? "" } : null;
  return {
    product: row.product,
    category: nz(row.category),
    vendor: nz(row.vendor),
    unitType: nz(row.unitType),
    servingUnitType: nz(row.servingUnitType),
  };
}

export type ListProductsArgs = {
  search?: string;
  categoryId?: string;
  vendorId?: string;
  status?: "ACTIVE" | "ARCHIVED";
  limit?: number;
  offset?: number;
};

export async function listProducts(ctx: ServiceCtx, args: ListProductsArgs = {}) {
  const filters: SQL[] = [eq(products.organizationId, ctx.orgId)];
  if (args.status) filters.push(eq(products.status, args.status));
  if (args.categoryId) filters.push(eq(products.categoryId, args.categoryId));
  if (args.vendorId) filters.push(eq(products.vendorId, args.vendorId));
  if (args.search) {
    const s = `%${args.search}%`;
    filters.push(or(ilike(products.name, s), ilike(products.sku, s))!);
  }
  const where = and(...filters);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
  const offset = Math.max(args.offset ?? 0, 0);

  const rows = await baseQuery()
    .where(where)
    .orderBy(asc(products.name))
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(products)
    .where(where);

  return { items: rows.map(shape), total: Number(total), limit, offset };
}

export async function getProduct(ctx: ServiceCtx, id: string) {
  const [row] = await baseQuery()
    .where(and(eq(products.organizationId, ctx.orgId), eq(products.id, id)))
    .limit(1);
  return row ? shape(row) : null;
}

export async function getProductBySku(ctx: ServiceCtx, sku: string) {
  const [row] = await baseQuery()
    .where(and(eq(products.organizationId, ctx.orgId), eq(products.sku, sku)))
    .limit(1);
  return row ? shape(row) : null;
}

function normalizeValues(input: ProductInput) {
  const v: Record<string, unknown> = {};
  const assign = (k: keyof ProductInput, val: unknown) => {
    if (val !== undefined) v[k] = val;
  };
  assign("name", input.name?.trim());
  assign("sku", input.sku?.trim());
  assign("inventoryTrackingMethod", input.inventoryTrackingMethod);
  assign("categoryId", input.categoryId);
  assign("vendorId", input.vendorId);
  assign("unitTypeId", input.unitTypeId);
  assign("unitPrice", input.unitPrice == null ? input.unitPrice : String(input.unitPrice));
  assign(
    "netQuantityPerUnit",
    input.netQuantityPerUnit == null ? input.netQuantityPerUnit : String(input.netQuantityPerUnit),
  );
  assign("servingUnitTypeId", input.servingUnitTypeId);
  assign("servingSize", input.servingSize == null ? input.servingSize : String(input.servingSize));
  assign("description", input.description);
  assign("customFields", input.customFields);
  assign("status", input.status);
  return v;
}

/** Create a new product. Requires name + sku. */
export async function createProduct(ctx: ServiceCtx, input: ProductInput) {
  if (!input.name || !input.sku) {
    throw new Error("Product name and SKU are required to create a product");
  }
  const values = normalizeValues(input);
  const [row] = await db
    .insert(products)
    .values({
      organizationId: ctx.orgId,
      name: input.name.trim(),
      sku: input.sku.trim(),
      ...values,
    })
    .returning();
  await recordAudit(ctx, {
    action: "product.create",
    entityType: "product",
    entityId: row.id,
    after: { name: row.name, sku: row.sku },
  });
  return (await getProduct(ctx, row.id))!;
}

export async function updateProduct(
  ctx: ServiceCtx,
  id: string,
  input: ProductInput,
) {
  const existing = await getProduct(ctx, id);
  if (!existing) throw new Error(`Product ${id} not found`);
  const values = normalizeValues(input);
  if (Object.keys(values).length > 0) {
    await db
      .update(products)
      .set(values)
      .where(and(eq(products.organizationId, ctx.orgId), eq(products.id, id)));
  }
  await recordAudit(ctx, {
    action: "product.update",
    entityType: "product",
    entityId: id,
    before: { name: existing.product.name, sku: existing.product.sku },
    after: values,
  });
  return (await getProduct(ctx, id))!;
}

/**
 * Sparse upsert (Distru semantics): if `id` present → update; else match by SKU
 * → update; else create. Returns the product plus whether it was created.
 */
export async function upsertProduct(ctx: ServiceCtx, input: ProductInput) {
  if (input.id) {
    return { product: await updateProduct(ctx, input.id, input), created: false };
  }
  if (input.sku) {
    const bySku = await getProductBySku(ctx, input.sku);
    if (bySku) {
      return {
        product: await updateProduct(ctx, bySku.product.id, input),
        created: false,
      };
    }
  }
  return { product: await createProduct(ctx, input), created: true };
}

export async function archiveProduct(ctx: ServiceCtx, id: string) {
  return updateProduct(ctx, id, { status: "ARCHIVED" });
}

/** Map of lowercased SKU → product id for the org (for price/inventory imports). */
export async function productSkuMap(ctx: ServiceCtx) {
  const rows = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, ctx.orgId));
  return new Map(rows.map((r) => [r.sku.toLowerCase(), r.id]));
}

export async function recentProducts(ctx: ServiceCtx, limit = 10) {
  const rows = await baseQuery()
    .where(eq(products.organizationId, ctx.orgId))
    .orderBy(desc(products.createdAt))
    .limit(limit);
  return rows.map(shape);
}

// ---------------- Distru-faithful API serialization ----------------

export function productToApi(p: ProductWithRefs) {
  const r = p.product;
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    inventory_tracking_method: r.inventoryTrackingMethod,
    unit_price: num(r.unitPrice),
    category: ref(p.category),
    vendor: ref(p.vendor),
    unit_type: ref(p.unitType),
    net_quantity_per_unit: num(r.netQuantityPerUnit),
    serving_size: num(r.servingSize),
    serving_unit_type: ref(p.servingUnitType),
    description: r.description ?? null,
    custom_fields: r.customFields ?? {},
    status: r.status,
    created_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}
