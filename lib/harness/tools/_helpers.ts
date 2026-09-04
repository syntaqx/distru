import type { ServiceCtx } from "@/lib/services/context";
import {
  getProduct,
  getProductBySku,
  listProducts,
  type ProductWithRefs,
} from "@/lib/services/products";

/** Resolve a product from an id, SKU, or fuzzy name. */
export async function resolveProduct(
  service: ServiceCtx,
  refInput: { id?: string; sku?: string; name?: string },
): Promise<ProductWithRefs | null> {
  if (refInput.id) return getProduct(service, refInput.id);
  if (refInput.sku) {
    const bySku = await getProductBySku(service, refInput.sku);
    if (bySku) return bySku;
  }
  if (refInput.name) {
    const { items } = await listProducts(service, { search: refInput.name, limit: 5 });
    const exact = items.find(
      (p) => p.product.name.toLowerCase() === refInput.name!.toLowerCase(),
    );
    return exact ?? items[0] ?? null;
  }
  return null;
}

export function productSummary(p: ProductWithRefs) {
  return {
    id: p.product.id,
    name: p.product.name,
    sku: p.product.sku,
    category: p.category?.name ?? null,
    vendor: p.vendor?.name ?? null,
    unit_type: p.unitType?.name ?? null,
    unit_price: p.product.unitPrice,
    tracking_method: p.product.inventoryTrackingMethod,
    status: p.product.status,
  };
}
