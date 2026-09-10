import {
  authenticate,
  distruError,
  dateRange,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  listProducts,
  listCategories,
  listCompanies,
  productToApi,
  upsertProduct,
  getProduct,
} from "@/lib/modules/catalog";
import {
  findOrCreateBrand,
  findOrCreateCategory,
  findOrCreateCompany,
  resolveUnitType,
} from "@/lib/modules/catalog";
import { emitEvent } from "@/lib/modules/platform";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const offset = pageOffset(req);
  const updated = dateRange(req, "updated_datetime");

  const statusParam = url.searchParams.get("status");
  const status = statusParam === "ACTIVE" || statusParam === "ARCHIVED" ? statusParam : undefined;

  // The spec filters category/vendor by NAME; the service takes ids, so resolve.
  const categoryName = url.searchParams.get("category");
  const vendorName = url.searchParams.get("vendor");
  const [cats, vendors] = await Promise.all([
    categoryName ? listCategories(auth.ctx) : Promise.resolve([]),
    vendorName ? listCompanies(auth.ctx) : Promise.resolve([]),
  ]);
  const categoryId = categoryName
    ? cats.find((c) => c.name.toLowerCase() === categoryName.toLowerCase())?.id
    : undefined;
  const vendorId = vendorName
    ? vendors.find((v) => v.name.toLowerCase() === vendorName.toLowerCase())?.id
    : undefined;
  // A named filter that matches nothing must return zero rows, not everything.
  if ((categoryName && !categoryId) || (vendorName && !vendorId)) {
    return listEnvelope(req, [], offset, 0);
  }

  const { items, total } = await listProducts(auth.ctx, {
    search: url.searchParams.get("search") ?? undefined,
    status,
    categoryId,
    vendorId,
    updatedFrom: updated.from,
    updatedTo: updated.to,
    limit: PAGE_SIZE,
    offset,
  });
  return listEnvelope(req, items.map(productToApi), offset, total);
}

type UpsertBody = {
  id?: string;
  name?: string;
  sku?: string;
  inventory_tracking_method?: "PACKAGE" | "PRODUCT" | "BATCH";
  category_id?: string | null;
  category?: string | null;
  vendor_id?: string | null;
  vendor?: string | null;
  brand_id?: string | null;
  brand?: string | null;
  strain_id?: string | null;
  subcategory_id?: string | null;
  product_group_id?: string | null;
  unit_type_id?: string | null;
  unit_type?: string | null;
  upc?: string | null;
  unit_price?: string | number | null;
  msrp?: string | number | null;
  // Distru field names (with older aliases still accepted).
  unit_net_weight?: string | number | null;
  net_quantity_per_unit?: string | number | null;
  unit_serving_size?: string | number | null;
  serving_size?: string | number | null;
  total_thc?: string | number | null;
  thc_content?: string | number | null;
  total_cbd?: string | number | null;
  cbd_content?: string | number | null;
  is_inventory_item?: boolean;
  is_sample?: boolean;
  taxable?: boolean;
  description?: string | null;
  is_active?: boolean;
  status?: "ACTIVE" | "ARCHIVED";
};

/** Sparse upsert, Distru-style: omit id to create, include to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as UpsertBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");

  // Resolve references from either explicit ids or names.
  let categoryId = body.category_id ?? undefined;
  if (categoryId === undefined && body.category)
    categoryId = (await findOrCreateCategory(auth.ctx, body.category)).id;

  let vendorId = body.vendor_id ?? undefined;
  if (vendorId === undefined && body.vendor)
    vendorId = (await findOrCreateCompany(auth.ctx, body.vendor)).id;

  let brandId = body.brand_id ?? undefined;
  if (brandId === undefined && body.brand)
    brandId = (await findOrCreateBrand(auth.ctx, body.brand)).id;

  let unitTypeId = body.unit_type_id ?? undefined;
  if (unitTypeId === undefined && body.unit_type) {
    const unit = await resolveUnitType(body.unit_type);
    if (!unit)
      return distruError(400, `Unknown unit type "${body.unit_type}"`, ["unit_type"], "body");
    unitTypeId = unit.id;
  }

  if (!body.id && (!body.name || !body.sku))
    return distruError(
      400,
      "name and sku are required to create a product",
      [!body.name ? "name" : "sku"],
      "body",
    );

  try {
    const { product, created } = await upsertProduct(auth.ctx, {
      id: body.id,
      name: body.name,
      sku: body.sku,
      inventoryTrackingMethod: body.inventory_tracking_method,
      categoryId,
      vendorId,
      brandId,
      strainId: body.strain_id,
      subcategoryId: body.subcategory_id,
      productGroupId: body.product_group_id,
      unitTypeId,
      upc: body.upc,
      unitPrice: body.unit_price,
      msrp: body.msrp,
      netQuantityPerUnit: body.unit_net_weight ?? body.net_quantity_per_unit,
      servingSize: body.unit_serving_size ?? body.serving_size,
      thcContent: body.total_thc ?? body.thc_content,
      cbdContent: body.total_cbd ?? body.cbd_content,
      isInventoryItem: body.is_inventory_item,
      isSample: body.is_sample,
      taxable: body.taxable,
      description: body.description,
      status:
        body.is_active === undefined
          ? body.status
          : body.is_active
            ? "ACTIVE"
            : "ARCHIVED",
    });
    const full = (await getProduct(auth.ctx, product.product.id))!;
    const api = productToApi(full);
    await emitEvent(
      auth.ctx,
      created ? "product.created" : "product.updated",
      api,
      { id: product.product.id },
    );
    return Response.json({ data: api }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Upsert failed", [], "body");
  }
}
