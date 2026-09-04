import type { ServiceCtx } from "@/lib/services/context";
import {
  listCategories,
  listCompanies,
  listUnitTypes,
  matchUnitType,
} from "@/lib/services/reference";
import { findOrCreateCategory, findOrCreateCompany } from "@/lib/services/reference";
import { upsertProduct } from "@/lib/services/products";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

type Prep = {
  units: { id: string; name: string }[];
  categoryByName: Map<string, string>;
  vendorByName: Map<string, string>;
};

type ProductValue = {
  name: string;
  sku: string;
  inventoryTrackingMethod: "PACKAGE" | "PRODUCT" | "BATCH";
  unitTypeId: string;
  categoryName: string | null;
  vendorName: string | null;
  unitPrice: string | null;
  netQuantityPerUnit: string | null;
  servingSize: string | null;
  description: string | null;
};

const FIELDS: CanonicalField[] = [
  {
    key: "name",
    label: "Product Name",
    type: "string",
    required: true,
    aliases: ["product", "product name", "item", "item name", "title", "description"],
  },
  {
    key: "sku",
    label: "SKU",
    type: "string",
    required: true,
    aliases: ["sku", "item number", "item #", "product code", "code", "id", "upc"],
  },
  {
    key: "inventory_tracking_method",
    label: "Inventory Tracking Method",
    type: "enum",
    required: false,
    enumValues: ["PACKAGE", "PRODUCT", "BATCH"],
    aliases: ["tracking", "tracking method", "inventory type", "track"],
  },
  {
    key: "category",
    label: "Category",
    type: "reference",
    referenceKind: "category",
    required: false,
    aliases: ["category", "type", "product type", "class", "department"],
  },
  {
    key: "vendor",
    label: "Vendor / Brand",
    type: "reference",
    referenceKind: "company",
    required: false,
    aliases: ["vendor", "brand", "supplier", "manufacturer", "producer", "make"],
  },
  {
    key: "unit_type",
    label: "Unit Type",
    type: "reference",
    referenceKind: "unitType",
    required: true,
    aliases: ["unit", "unit type", "uom", "unit of measure", "measure", "units"],
  },
  {
    key: "unit_price",
    label: "Unit Price",
    type: "number",
    required: false,
    aliases: ["price", "unit price", "cost", "msrp", "wholesale price", "amount"],
  },
  {
    key: "net_quantity_per_unit",
    label: "Net Quantity per Unit",
    type: "number",
    required: false,
    aliases: ["net weight", "net qty", "net quantity", "weight", "size"],
  },
  {
    key: "serving_size",
    label: "Serving Size",
    type: "number",
    required: false,
    aliases: ["serving size", "serving", "dose"],
  },
  {
    key: "description",
    label: "Description",
    type: "string",
    required: false,
    aliases: ["description", "notes", "details", "long description"],
  },
];

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumber(v: unknown): { value: string | null; bad: boolean } {
  const s = str(v);
  if (s === null) return { value: null, bad: false };
  const cleaned = s.replace(/[$,\s]/g, "").replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return { value: null, bad: true };
  return { value: String(Number(cleaned)), bad: false };
}

export const productsTarget: ImportTarget<Prep, ProductValue> = {
  key: "products",
  label: "Products",
  description:
    "Import a product catalog. Maps arbitrary columns to Distru's product " +
    "schema (name, SKU, category, vendor/brand, unit type, unit price, tracking " +
    "method) and upserts by SKU.",
  fields: FIELDS,

  async prepare(ctx: ServiceCtx): Promise<Prep> {
    const [units, cats, vendors] = await Promise.all([
      listUnitTypes(),
      listCategories(ctx),
      listCompanies(ctx),
    ]);
    return {
      units: units.map((u) => ({ id: u.id, name: u.name })),
      categoryByName: new Map(cats.map((c) => [c.name.toLowerCase(), c.id])),
      vendorByName: new Map(vendors.map((v) => [v.name.toLowerCase(), v.id])),
    };
  },

  validateRow(mapped, prep) {
    const errors: RowError[] = [];
    const warnings: RowError[] = [];
    const newRefs: { kind: string; value: string }[] = [];

    const name = str(mapped.name);
    if (!name) errors.push({ field: "name", code: "required", message: "Product Name is required" });

    const sku = str(mapped.sku);
    if (!sku) errors.push({ field: "sku", code: "required", message: "SKU is required" });

    // tracking method (default PACKAGE)
    let tracking: "PACKAGE" | "PRODUCT" | "BATCH" = "PACKAGE";
    const rawTracking = str(mapped.inventory_tracking_method);
    if (rawTracking) {
      const up = rawTracking.toUpperCase();
      if (up === "PACKAGE" || up === "PRODUCT" || up === "BATCH") tracking = up;
      else
        warnings.push({
          field: "inventory_tracking_method",
          code: "enum",
          message: `Unknown tracking method "${rawTracking}", defaulted to PACKAGE`,
        });
    }

    // unit type (required, must resolve to a known unit)
    const unitRaw = str(mapped.unit_type);
    const unit = matchUnitType(prep.units, unitRaw);
    if (!unitRaw) {
      errors.push({ field: "unit_type", code: "required", message: "Unit Type is required" });
    } else if (!unit) {
      errors.push({
        field: "unit_type",
        code: "unknown_unit",
        message: `Unrecognized unit type "${unitRaw}"`,
      });
    }

    // price
    const price = parseNumber(mapped.unit_price);
    if (price.bad)
      errors.push({ field: "unit_price", code: "not_a_number", message: `Unit Price "${mapped.unit_price}" is not a number` });

    const netQty = parseNumber(mapped.net_quantity_per_unit);
    if (netQty.bad)
      warnings.push({ field: "net_quantity_per_unit", code: "not_a_number", message: "Net quantity is not a number, ignored" });
    const serving = parseNumber(mapped.serving_size);
    if (serving.bad)
      warnings.push({ field: "serving_size", code: "not_a_number", message: "Serving size is not a number, ignored" });

    // references that will be created on commit
    const categoryName = str(mapped.category);
    if (categoryName && !prep.categoryByName.has(categoryName.toLowerCase()))
      newRefs.push({ kind: "category", value: categoryName });
    const vendorName = str(mapped.vendor);
    if (vendorName && !prep.vendorByName.has(vendorName.toLowerCase()))
      newRefs.push({ kind: "vendor", value: vendorName });

    if (errors.length > 0) return { ok: false, errors, newRefs };

    return {
      ok: true,
      warnings,
      newRefs,
      value: {
        name: name!,
        sku: sku!,
        inventoryTrackingMethod: tracking,
        unitTypeId: unit!.id,
        categoryName,
        vendorName,
        unitPrice: price.value,
        netQuantityPerUnit: netQty.value,
        servingSize: serving.value,
        description: str(mapped.description),
      },
    };
  },

  async commitRows(rows, ctx, prep) {
    const out: { productId?: string | null }[] = [];
    for (const { value } of rows) {
      let categoryId: string | null = null;
      if (value.categoryName) {
        const key = value.categoryName.toLowerCase();
        categoryId =
          prep.categoryByName.get(key) ??
          (await findOrCreateCategory(ctx, value.categoryName)).id;
        prep.categoryByName.set(key, categoryId);
      }
      let vendorId: string | null = null;
      if (value.vendorName) {
        const key = value.vendorName.toLowerCase();
        vendorId =
          prep.vendorByName.get(key) ??
          (await findOrCreateCompany(ctx, value.vendorName)).id;
        prep.vendorByName.set(key, vendorId);
      }
      const { product } = await upsertProduct(ctx, {
        name: value.name,
        sku: value.sku,
        inventoryTrackingMethod: value.inventoryTrackingMethod,
        unitTypeId: value.unitTypeId,
        categoryId,
        vendorId,
        unitPrice: value.unitPrice,
        netQuantityPerUnit: value.netQuantityPerUnit,
        servingSize: value.servingSize,
        description: value.description,
      });
      out.push({ productId: product.product.id });
    }
    return out;
  },
};
