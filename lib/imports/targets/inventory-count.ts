import type { ServiceCtx } from "@/lib/services/context";
import { productSkuMap } from "@/lib/services/products";
import { getDefaultLocation } from "@/lib/services/reference";
import { setOnHand } from "@/lib/services/inventory";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

type Prep = { skuMap: Map<string, string>; defaultLocationId: string };
type CountValue = { productId: string; sku: string; quantity: number };

const FIELDS: CanonicalField[] = [
  {
    key: "sku",
    label: "SKU",
    type: "string",
    required: true,
    aliases: ["sku", "item #", "item number", "product code", "code", "upc"],
  },
  {
    key: "quantity",
    label: "On-hand Quantity",
    type: "number",
    required: true,
    aliases: ["quantity", "qty", "on hand", "on-hand", "count", "stock", "units", "inventory"],
  },
];

/**
 * A physical/cycle count: set each product's on-hand to an absolute quantity by
 * SKU (posts the delta to the inventory ledger). Unknown SKUs error out.
 */
export const inventoryCountTarget: ImportTarget<Prep, CountValue> = {
  key: "inventory-count",
  label: "Inventory Count",
  description:
    "Set on-hand quantities from a physical/cycle count (matches on SKU, posts adjustments to the ledger).",
  fields: FIELDS,
  async prepare(ctx: ServiceCtx) {
    const [skuMap, loc] = await Promise.all([
      productSkuMap(ctx),
      getDefaultLocation(ctx),
    ]);
    return { skuMap, defaultLocationId: loc.id };
  },
  validateRow(mapped, prep) {
    const errors: RowError[] = [];
    const sku = mapped.sku ? String(mapped.sku).trim() : "";
    if (!sku) errors.push({ field: "sku", code: "required", message: "SKU is required" });
    const raw = mapped.quantity;
    const qty = raw === null || raw === undefined || String(raw).trim() === "" ? NaN : Number(String(raw).replace(/[,\s]/g, ""));
    if (Number.isNaN(qty))
      errors.push({ field: "quantity", code: "not_a_number", message: `Quantity "${raw}" is not a number` });
    const productId = sku ? prep.skuMap.get(sku.toLowerCase()) : undefined;
    if (sku && !productId)
      errors.push({ field: "sku", code: "unknown_sku", message: `No product found with SKU "${sku}"` });
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, value: { productId: productId!, sku, quantity: qty } };
  },
  async commitRows(rows, ctx, prep) {
    const out: { productId?: string | null }[] = [];
    for (const { value } of rows) {
      await setOnHand(ctx, {
        productId: value.productId,
        locationId: prep.defaultLocationId,
        target: value.quantity,
        reason: "cycle count import",
      });
      out.push({ productId: value.productId });
    }
    return out;
  },
};
