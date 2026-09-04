import {
  authenticate,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageNumber,
  requireScope,
} from "@/lib/public-api";
import {
  listProducts,
  productToApi,
  upsertProduct,
  getProduct,
} from "@/lib/services/products";
import {
  findOrCreateCategory,
  findOrCreateCompany,
  resolveUnitType,
} from "@/lib/services/reference";
import { emitEvent } from "@/lib/services/webhooks";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const page = pageNumber(req);
  const { items, total } = await listProducts(auth.ctx, {
    search: url.searchParams.get("search") ?? undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  return listEnvelope(req, items.map(productToApi), page, total);
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
  unit_type_id?: string | null;
  unit_type?: string | null;
  unit_price?: string | number | null;
  net_quantity_per_unit?: string | number | null;
  serving_size?: string | number | null;
  description?: string | null;
  status?: "ACTIVE" | "ARCHIVED";
};

/** Sparse upsert, Distru-style: omit id to create, include to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "products:write");
  if (scopeErr) return scopeErr;

  const body = (await req.json().catch(() => null)) as UpsertBody | null;
  if (!body) return distruError(400, "Invalid JSON body");

  // Resolve references from either explicit ids or names.
  let categoryId = body.category_id ?? undefined;
  if (categoryId === undefined && body.category)
    categoryId = (await findOrCreateCategory(auth.ctx, body.category)).id;

  let vendorId = body.vendor_id ?? undefined;
  if (vendorId === undefined && body.vendor)
    vendorId = (await findOrCreateCompany(auth.ctx, body.vendor)).id;

  let unitTypeId = body.unit_type_id ?? undefined;
  if (unitTypeId === undefined && body.unit_type) {
    const unit = await resolveUnitType(body.unit_type);
    if (!unit)
      return distruError(400, `Unknown unit type "${body.unit_type}"`, ["unit_type"]);
    unitTypeId = unit.id;
  }

  if (!body.id && (!body.name || !body.sku))
    return distruError(400, "name and sku are required to create a product", ["sku"]);

  try {
    const { product, created } = await upsertProduct(auth.ctx, {
      id: body.id,
      name: body.name,
      sku: body.sku,
      inventoryTrackingMethod: body.inventory_tracking_method,
      categoryId,
      vendorId,
      unitTypeId,
      unitPrice: body.unit_price,
      netQuantityPerUnit: body.net_quantity_per_unit,
      servingSize: body.serving_size,
      description: body.description,
      status: body.status,
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
    return distruError(400, err instanceof Error ? err.message : "Upsert failed");
  }
}
