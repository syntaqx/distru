import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  categories,
  companies,
  productGroups,
  productImages,
  productSubcategories,
  products,
  strains,
  unitTypes,
} from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit, customData, datetime, num, ref } from "../shared";
import { getMarketplaceProvider } from "@/lib/integrations/sync";

export type ProductRow = typeof products.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;
type Named = { id: string; name: string } | null;

export type ProductWithRefs = {
  product: ProductRow;
  category: Named;
  vendor: Named;
  brand: Named;
  strain: Named;
  subcategory: Named;
  productGroup: Named;
  unitType: Named;
  servingUnitType: Named;
  images: ProductImageRow[];
};

/** Sparse upsert input, mirroring Distru: omit id to create, include to update. */
export type ProductInput = {
  id?: string;
  sku?: string;
  name?: string;
  inventoryTrackingMethod?: "PACKAGE" | "PRODUCT" | "BATCH";
  categoryId?: string | null;
  vendorId?: string | null;
  brandId?: string | null;
  strainId?: string | null;
  subcategoryId?: string | null;
  productGroupId?: string | null;
  unitTypeId?: string | null;
  unitPrice?: string | number | null;
  msrp?: string | number | null;
  netQuantityPerUnit?: string | number | null;
  servingUnitTypeId?: string | null;
  servingSize?: string | number | null;
  upc?: string | null;
  thcContent?: string | number | null;
  cbdContent?: string | number | null;
  isInventoryItem?: boolean;
  isSample?: boolean;
  taxable?: boolean;
  description?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
  status?: "ACTIVE" | "ARCHIVED";
};

const servingUnit = alias(unitTypes, "serving_unit");
const brandCompany = alias(companies, "brand_company");

function selectShape() {
  return {
    product: products,
    category: { id: categories.id, name: categories.name },
    vendor: { id: companies.id, name: companies.name },
    brand: { id: brandCompany.id, name: brandCompany.name },
    strain: { id: strains.id, name: strains.name },
    subcategory: { id: productSubcategories.id, name: productSubcategories.name },
    productGroup: { id: productGroups.id, name: productGroups.name },
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
    .leftJoin(brandCompany, eq(products.brandId, brandCompany.id))
    .leftJoin(strains, eq(products.strainId, strains.id))
    .leftJoin(productSubcategories, eq(products.subcategoryId, productSubcategories.id))
    .leftJoin(productGroups, eq(products.productGroupId, productGroups.id))
    .leftJoin(unitTypes, eq(products.unitTypeId, unitTypes.id))
    .leftJoin(servingUnit, eq(products.servingUnitTypeId, servingUnit.id));
}

type ShapeRow = {
  product: ProductRow;
  category: { id: string | null; name: string | null } | null;
  vendor: { id: string | null; name: string | null } | null;
  brand: { id: string | null; name: string | null } | null;
  strain: { id: string | null; name: string | null } | null;
  subcategory: { id: string | null; name: string | null } | null;
  productGroup: { id: string | null; name: string | null } | null;
  unitType: { id: string | null; name: string | null } | null;
  servingUnitType: { id: string | null; name: string | null } | null;
};

function shape(row: ShapeRow, images: ProductImageRow[] = []): ProductWithRefs {
  const nz = (r: { id: string | null; name: string | null } | null) =>
    r && r.id ? { id: r.id, name: r.name ?? "" } : null;
  return {
    product: row.product,
    category: nz(row.category),
    vendor: nz(row.vendor),
    brand: nz(row.brand),
    strain: nz(row.strain),
    subcategory: nz(row.subcategory),
    productGroup: nz(row.productGroup),
    unitType: nz(row.unitType),
    servingUnitType: nz(row.servingUnitType),
    images,
  };
}

/** Load images for a set of products, keyed by productId (primary first). */
async function imagesByProduct(productIds: string[]): Promise<Map<string, ProductImageRow[]>> {
  const map = new Map<string, ProductImageRow[]>();
  if (!productIds.length) return map;
  const rows = await db
    .select()
    .from(productImages)
    .where(inArray(productImages.productId, productIds))
    .orderBy(desc(productImages.isPrimary), asc(productImages.position));
  for (const img of rows) {
    const arr = map.get(img.productId) ?? [];
    arr.push(img);
    map.set(img.productId, arr);
  }
  return map;
}

export type ListProductsArgs = {
  search?: string;
  categoryId?: string;
  vendorId?: string;
  status?: "ACTIVE" | "ARCHIVED";
  updatedFrom?: Date;
  updatedTo?: Date;
  limit?: number;
  offset?: number;
};

export async function listProducts(ctx: ServiceCtx, args: ListProductsArgs = {}) {
  const filters: SQL[] = [eq(products.organizationId, ctx.orgId)];
  if (args.status) filters.push(eq(products.status, args.status));
  if (args.categoryId) filters.push(eq(products.categoryId, args.categoryId));
  if (args.vendorId) filters.push(eq(products.vendorId, args.vendorId));
  if (args.updatedFrom) filters.push(gte(products.updatedAt, args.updatedFrom));
  if (args.updatedTo) filters.push(lte(products.updatedAt, args.updatedTo));
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

  const imgs = await imagesByProduct(rows.map((r) => r.product.id));
  const items = rows.map((r) => shape(r, imgs.get(r.product.id) ?? []));
  return { items, total: Number(total), limit, offset };
}

export async function getProduct(ctx: ServiceCtx, id: string) {
  const [row] = await baseQuery()
    .where(and(eq(products.organizationId, ctx.orgId), eq(products.id, id)))
    .limit(1);
  if (!row) return null;
  return shape(row, (await imagesByProduct([row.product.id])).get(row.product.id) ?? []);
}

export async function getProductBySku(ctx: ServiceCtx, sku: string) {
  const [row] = await baseQuery()
    .where(and(eq(products.organizationId, ctx.orgId), eq(products.sku, sku)))
    .limit(1);
  if (!row) return null;
  return shape(row, (await imagesByProduct([row.product.id])).get(row.product.id) ?? []);
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
  assign("brandId", input.brandId);
  assign("strainId", input.strainId);
  assign("subcategoryId", input.subcategoryId);
  assign("productGroupId", input.productGroupId);
  assign("unitTypeId", input.unitTypeId);
  assign("unitPrice", input.unitPrice == null ? input.unitPrice : String(input.unitPrice));
  assign("msrp", input.msrp == null ? input.msrp : String(input.msrp));
  assign(
    "netQuantityPerUnit",
    input.netQuantityPerUnit == null ? input.netQuantityPerUnit : String(input.netQuantityPerUnit),
  );
  assign("servingUnitTypeId", input.servingUnitTypeId);
  assign("servingSize", input.servingSize == null ? input.servingSize : String(input.servingSize));
  assign("upc", input.upc);
  assign("thcContent", input.thcContent == null ? input.thcContent : String(input.thcContent));
  assign("cbdContent", input.cbdContent == null ? input.cbdContent : String(input.cbdContent));
  assign("isInventoryItem", input.isInventoryItem);
  assign("isSample", input.isSample);
  assign("taxable", input.taxable);
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

// ---------------- Bulk operations (one write, one audit entry) ----------------

export type BulkProductFilter = {
  status?: "ACTIVE" | "ARCHIVED";
  categoryId?: string;
  vendorId?: string;
  search?: string;
};

function bulkWhere(ctx: ServiceCtx, f: BulkProductFilter) {
  const filters: SQL[] = [eq(products.organizationId, ctx.orgId)];
  if (f.status) filters.push(eq(products.status, f.status));
  if (f.categoryId) filters.push(eq(products.categoryId, f.categoryId));
  if (f.vendorId) filters.push(eq(products.vendorId, f.vendorId));
  if (f.search) {
    const s = `%${f.search}%`;
    filters.push(or(ilike(products.name, s), ilike(products.sku, s))!);
  }
  return and(...filters);
}

/** Count products matching a bulk filter (for confirmation previews). */
export async function countProducts(ctx: ServiceCtx, f: BulkProductFilter = {}) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(products)
    .where(bulkWhere(ctx, f));
  return Number(value);
}

/** All product ids matching a bulk filter (no page cap; for bulk inventory). */
export async function productIdsMatching(ctx: ServiceCtx, f: BulkProductFilter = {}) {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(bulkWhere(ctx, f));
  return rows.map((r) => r.id);
}

/**
 * Apply the same field changes to every product matching a filter in a single
 * UPDATE, with one audit entry. Powers "set all prices to X" style bulk edits so
 * the agent needs one approval, not one per product.
 */
export async function bulkUpdateProducts(
  ctx: ServiceCtx,
  args: { filter: BulkProductFilter; set: ProductInput },
) {
  const values = normalizeValues(args.set);
  if (Object.keys(values).length === 0) return { updated: 0 };
  const rows = await db
    .update(products)
    .set(values)
    .where(bulkWhere(ctx, args.filter))
    .returning({ id: products.id });
  await recordAudit(ctx, {
    action: "product.bulk_update",
    entityType: "product",
    entityId: "*",
    after: { ...values, count: rows.length },
  });
  return { updated: rows.length };
}

/** Map of lowercased SKU → product id for the org (for price/inventory imports). */
export async function productSkuMap(ctx: ServiceCtx) {
  const rows = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, ctx.orgId));
  return new Map(rows.map((r) => [r.sku.toLowerCase(), r.id]));
}

/** Map of lowercased SKU → { id, name, unitPrice } for order/line imports. */
export async function productSkuInfoMap(ctx: ServiceCtx) {
  const rows = await db
    .select({ id: products.id, sku: products.sku, name: products.name, unitPrice: products.unitPrice })
    .from(products)
    .where(eq(products.organizationId, ctx.orgId));
  return new Map(
    rows.map((r) => [r.sku.toLowerCase(), { id: r.id, name: r.name, unitPrice: r.unitPrice }]),
  );
}

export async function recentProducts(ctx: ServiceCtx, limit = 10) {
  const rows = await baseQuery()
    .where(eq(products.organizationId, ctx.orgId))
    .orderBy(desc(products.createdAt))
    .limit(limit);
  return rows.map((r) => shape(r));
}

// ---------------- Distru-faithful API serialization ----------------

export function productToApi(p: ProductWithRefs) {
  const r = p.product;
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    upc: r.upc ?? null,
    inventory_tracking_method: r.inventoryTrackingMethod,
    unit_price: num(r.unitPrice),
    msrp: num(r.msrp),
    category: ref(p.category),
    subcategory: ref(p.subcategory),
    vendor: ref(p.vendor),
    brand: ref(p.brand),
    strain: ref(p.strain),
    product_group: ref(p.productGroup),
    unit_type: ref(p.unitType),
    unit_net_weight: num(r.netQuantityPerUnit),
    unit_serving_size: num(r.servingSize),
    serving_unit_type: ref(p.servingUnitType),
    total_thc: num(r.thcContent),
    total_cbd: num(r.cbdContent),
    is_inventory_item: r.isInventoryItem,
    is_sample: r.isSample,
    taxable: r.taxable,
    description: r.description ?? null,
    images: p.images.map((img) => ({
      id: img.id,
      url: img.dataUrl,
      position: img.position,
      is_primary: img.isPrimary,
    })),
    custom_data: customData(r.customFields),
    is_active: r.status === "ACTIVE",
    // Distru-parity fields this clone does not track (present as null/defaults so
    // the wire shape matches; see DISTRU-PARITY.md §5 Tier 3).
    external_name: null,
    is_featured: false,
    unit_cost: null,
    wholesale_unit_price: null,
    total_cannabinoid_unit: null,
    quantity_available: null,
    quantity_active: null,
    quantity_reserved: null,
    owner: null,
    creator: null,
    tasks: [],
    deleted_at: null,
    leaflink_product_id: getMarketplaceProvider().productId(r.id),
    inserted_datetime: datetime(r.createdAt),
    updated_datetime: datetime(r.updatedAt),
  };
}

// ---------------- Product images ----------------

export async function listProductImages(ctx: ServiceCtx, productId: string) {
  return db
    .select()
    .from(productImages)
    .where(and(eq(productImages.organizationId, ctx.orgId), eq(productImages.productId, productId)))
    .orderBy(desc(productImages.isPrimary), asc(productImages.position));
}

/** Add an image (a data URL). The first image on a product becomes primary. */
export async function addProductImage(ctx: ServiceCtx, productId: string, dataUrl: string) {
  const existing = await listProductImages(ctx, productId);
  const [row] = await db
    .insert(productImages)
    .values({
      organizationId: ctx.orgId,
      productId,
      dataUrl,
      position: existing.length,
      isPrimary: existing.length === 0,
    })
    .returning();
  await recordAudit(ctx, { action: "product.image.add", entityType: "product", entityId: productId });
  return row;
}

export async function deleteProductImage(ctx: ServiceCtx, imageId: string) {
  const [img] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.organizationId, ctx.orgId), eq(productImages.id, imageId)))
    .limit(1);
  if (!img) return;
  await db.delete(productImages).where(eq(productImages.id, imageId));
  // If we removed the primary, promote the next image.
  if (img.isPrimary) {
    const [next] = await listProductImages(ctx, img.productId);
    if (next) await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
  }
}

export async function setPrimaryProductImage(ctx: ServiceCtx, imageId: string) {
  const [img] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.organizationId, ctx.orgId), eq(productImages.id, imageId)))
    .limit(1);
  if (!img) throw new Error("Image not found.");
  await db
    .update(productImages)
    .set({ isPrimary: false })
    .where(eq(productImages.productId, img.productId));
  await db.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId));
}
