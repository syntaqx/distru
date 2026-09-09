import type { ServiceCtx } from "@/lib/modules/shared";
import {
  listCategories,
  listCompanies,
  listUnitTypes,
  matchUnitType,
} from "@/lib/modules/catalog";
import {
  findOrCreateBrand,
  findOrCreateCategory,
  findOrCreateCompany,
  getDefaultLocation,
} from "@/lib/modules/catalog";
import { addProductImage, listProductImages, upsertProduct } from "@/lib/modules/catalog";
import { setOnHand } from "@/lib/modules/inventory";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

/**
 * Fetch an image URL server-side and return it as a data URL, or null if it
 * can't be used. Guards against SSRF/abuse: http(s) only, an image content-type,
 * an 8s timeout, and a 4MB cap. A row never fails because an image didn't load -
 * the product still imports; the image is just skipped.
 */
async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:image/")) return url;
    if (!/^https?:\/\//i.test(url)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "follow" });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 4_000_000) return null;
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Split an image cell into candidate URLs. http(s) URLs may be comma / pipe /
 * whitespace separated (multiple images); a single data: URL is kept whole
 * (data URLs contain a comma after "base64", so they must not be comma-split).
 */
function imageUrls(raw: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("data:image/")) return [trimmed];
  return trimmed
    .split(/[,|\n\r\t ]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
    .slice(0, 8);
}

type Prep = {
  units: { id: string; name: string }[];
  categoryByName: Map<string, string>;
  vendorByName: Map<string, string>;
  brandByName: Map<string, string>;
};

type ProductValue = {
  name: string;
  sku: string;
  upc: string | null;
  inventoryTrackingMethod: "PACKAGE" | "PRODUCT" | "BATCH";
  unitTypeId: string;
  categoryName: string | null;
  vendorName: string | null;
  brandName: string | null;
  unitPrice: string | null;
  msrp: string | null;
  netQuantityPerUnit: string | null;
  servingSize: string | null;
  thcContent: string | null;
  cbdContent: string | null;
  onHand: number | null;
  description: string | null;
  imageUrls: string[];
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
    aliases: ["sku", "item number", "item #", "product code", "code", "product id"],
  },
  {
    key: "upc",
    label: "UPC / Barcode",
    type: "string",
    required: false,
    aliases: ["upc", "barcode", "bar code", "gtin", "ean", "upc code"],
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
    label: "Vendor",
    type: "reference",
    referenceKind: "company",
    required: false,
    aliases: ["vendor", "supplier", "manufacturer", "distributor", "make"],
  },
  {
    key: "brand",
    label: "Brand",
    type: "reference",
    referenceKind: "company",
    required: false,
    aliases: ["brand", "brand name", "producer", "label", "product brand"],
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
    aliases: ["price", "unit price", "cost", "wholesale price", "wholesale", "amount", "each"],
  },
  {
    key: "msrp",
    label: "MSRP",
    type: "number",
    required: false,
    aliases: ["msrp", "retail price", "retail", "list price", "suggested price", "srp"],
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
    key: "thc_content",
    label: "THC %",
    type: "number",
    required: false,
    aliases: ["thc", "thc %", "thc percent", "thc content", "total thc", "%thc"],
  },
  {
    key: "cbd_content",
    label: "CBD %",
    type: "number",
    required: false,
    aliases: ["cbd", "cbd %", "cbd percent", "cbd content", "total cbd", "%cbd"],
  },
  {
    key: "quantity",
    label: "Quantity on hand",
    type: "number",
    required: false,
    aliases: ["quantity", "qty", "on hand", "on-hand", "onhand", "stock", "count", "inventory", "units", "available", "in stock", "qty on hand", "quantity on hand", "current stock"],
  },
  {
    key: "description",
    label: "Description",
    type: "string",
    required: false,
    aliases: ["description", "notes", "details", "long description"],
  },
  {
    key: "image",
    label: "Image URL",
    type: "string",
    required: false,
    aliases: ["image", "image url", "image_url", "images", "photo", "photo url", "picture", "img", "thumbnail", "image link"],
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
    "schema (name, SKU, UPC, category, vendor, brand, unit type, unit price, " +
    "MSRP, THC/CBD %, tracking method, quantity on-hand, and image URLs) and " +
    "upserts by SKU. Image URLs are downloaded and attached; a quantity column " +
    "sets on-hand at the default location.",
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
      brandByName: new Map(vendors.map((v) => [v.name.toLowerCase(), v.id])),
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

    const msrp = parseNumber(mapped.msrp);
    if (msrp.bad)
      warnings.push({ field: "msrp", code: "not_a_number", message: "MSRP is not a number, ignored" });

    const netQty = parseNumber(mapped.net_quantity_per_unit);
    if (netQty.bad)
      warnings.push({ field: "net_quantity_per_unit", code: "not_a_number", message: "Net quantity is not a number, ignored" });
    const serving = parseNumber(mapped.serving_size);
    if (serving.bad)
      warnings.push({ field: "serving_size", code: "not_a_number", message: "Serving size is not a number, ignored" });

    const thc = parseNumber(mapped.thc_content);
    if (thc.bad)
      warnings.push({ field: "thc_content", code: "not_a_number", message: "THC % is not a number, ignored" });
    const cbd = parseNumber(mapped.cbd_content);
    if (cbd.bad)
      warnings.push({ field: "cbd_content", code: "not_a_number", message: "CBD % is not a number, ignored" });

    // quantity on-hand - applied to the default location on commit
    const qty = parseNumber(mapped.quantity);
    if (qty.bad)
      warnings.push({ field: "quantity", code: "not_a_number", message: "Quantity is not a number, ignored" });

    // image URL(s) - downloaded and attached on commit
    const imgRaw = str(mapped.image);
    const imgUrls = imageUrls(imgRaw);
    if (imgRaw && imgUrls.length === 0)
      warnings.push({ field: "image", code: "bad_url", message: `Image "${imgRaw}" is not a valid URL, ignored` });

    // references that will be created on commit
    const categoryName = str(mapped.category);
    if (categoryName && !prep.categoryByName.has(categoryName.toLowerCase()))
      newRefs.push({ kind: "category", value: categoryName });
    const vendorName = str(mapped.vendor);
    if (vendorName && !prep.vendorByName.has(vendorName.toLowerCase()))
      newRefs.push({ kind: "vendor", value: vendorName });
    const brandName = str(mapped.brand);
    if (brandName && !prep.brandByName.has(brandName.toLowerCase()))
      newRefs.push({ kind: "brand", value: brandName });

    if (errors.length > 0) return { ok: false, errors, newRefs };

    return {
      ok: true,
      warnings,
      newRefs,
      value: {
        name: name!,
        sku: sku!,
        upc: str(mapped.upc),
        inventoryTrackingMethod: tracking,
        unitTypeId: unit!.id,
        categoryName,
        vendorName,
        brandName,
        unitPrice: price.value,
        msrp: msrp.value,
        netQuantityPerUnit: netQty.value,
        servingSize: serving.value,
        thcContent: thc.value,
        cbdContent: cbd.value,
        onHand: qty.value === null ? null : Number(qty.value),
        description: str(mapped.description),
        imageUrls: imgUrls,
      },
    };
  },

  async commitRows(rows, ctx, prep) {
    const out: { productId?: string | null }[] = [];
    let defaultLocationId: string | null = null;
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
      let brandId: string | null = null;
      if (value.brandName) {
        const key = value.brandName.toLowerCase();
        brandId =
          prep.brandByName.get(key) ??
          (await findOrCreateBrand(ctx, value.brandName)).id;
        prep.brandByName.set(key, brandId);
        // a brand company is also a valid vendor lookup and vice-versa
        if (!prep.vendorByName.has(key)) prep.vendorByName.set(key, brandId);
      }
      const { product } = await upsertProduct(ctx, {
        name: value.name,
        sku: value.sku,
        upc: value.upc,
        inventoryTrackingMethod: value.inventoryTrackingMethod,
        unitTypeId: value.unitTypeId,
        categoryId,
        vendorId,
        brandId,
        unitPrice: value.unitPrice,
        msrp: value.msrp,
        netQuantityPerUnit: value.netQuantityPerUnit,
        servingSize: value.servingSize,
        thcContent: value.thcContent,
        cbdContent: value.cbdContent,
        description: value.description,
      });
      const productId = product.product.id;

      // On-hand from the quantity column, set at the org's default location.
      if (value.onHand !== null) {
        if (defaultLocationId === null) defaultLocationId = (await getDefaultLocation(ctx)).id;
        await setOnHand(ctx, {
          productId,
          locationId: defaultLocationId,
          target: value.onHand,
          reason: "product import",
        });
      }

      // Download + attach any image URLs. Only when the product has no images yet,
      // so re-importing the same file doesn't pile up duplicates. A failed fetch
      // is skipped silently - the product is already committed.
      if (value.imageUrls.length) {
        const existing = await listProductImages(ctx, productId);
        if (existing.length === 0) {
          for (const url of value.imageUrls) {
            const dataUrl = await fetchImageDataUrl(url);
            if (dataUrl) await addProductImage(ctx, productId, dataUrl);
          }
        }
      }

      out.push({ productId });
    }
    return out;
  },
};
