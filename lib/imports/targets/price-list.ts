import type { ServiceCtx } from "@/lib/modules/shared";
import { productSkuMap, updateProduct } from "@/lib/modules/catalog";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

type Prep = { skuMap: Map<string, string> };
type PriceValue = { productId: string; sku: string; unitPrice: string };

const FIELDS: CanonicalField[] = [
  {
    key: "sku",
    label: "SKU",
    type: "string",
    required: true,
    aliases: ["sku", "item #", "item number", "product code", "code", "upc"],
  },
  {
    key: "unit_price",
    label: "Unit Price",
    type: "number",
    required: true,
    aliases: ["price", "unit price", "wholesale price", "wholesale", "cost", "msrp", "list price"],
  },
];

function parsePrice(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const cleaned = String(v).replace(/[$,\s]/g, "").replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return null;
  return String(Number(cleaned));
}

/**
 * A price sheet / price list: update existing products' unit price by SKU.
 * Rows whose SKU isn't in the catalog error out (so a price sheet can't
 * silently create half-formed products).
 */
export const priceListTarget: ImportTarget<Prep, PriceValue> = {
  key: "price-list",
  label: "Price List",
  description:
    "Update existing product prices from a price sheet (matches on SKU). Rows for unknown SKUs are reported as errors.",
  fields: FIELDS,
  async prepare(ctx: ServiceCtx) {
    return { skuMap: await productSkuMap(ctx) };
  },
  validateRow(mapped, prep) {
    const errors: RowError[] = [];
    const sku = mapped.sku ? String(mapped.sku).trim() : "";
    if (!sku) errors.push({ field: "sku", code: "required", message: "SKU is required" });
    const price = parsePrice(mapped.unit_price);
    if (price === null)
      errors.push({ field: "unit_price", code: "not_a_number", message: `Price "${mapped.unit_price}" is not a number` });
    const productId = sku ? prep.skuMap.get(sku.toLowerCase()) : undefined;
    if (sku && !productId)
      errors.push({ field: "sku", code: "unknown_sku", message: `No product found with SKU "${sku}"` });
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: { productId: productId!, sku, unitPrice: price! } };
  },
  async commitRows(rows, ctx) {
    const out: { productId?: string | null }[] = [];
    for (const { value } of rows) {
      await updateProduct(ctx, value.productId, { unitPrice: value.unitPrice });
      out.push({ productId: value.productId });
    }
    return out;
  },
};
