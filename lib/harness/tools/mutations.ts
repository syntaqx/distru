import { z } from "zod";
import { defineTool } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  archiveProduct,
  bulkUpdateProducts,
  countProducts,
  createProduct,
  productIdsMatching,
  updateProduct,
  type BulkProductFilter,
  type ProductInput,
} from "@/lib/modules/catalog";
import {
  createCategory,
  createCompany,
  findCategoryByName,
  findCompanyByName,
  findOrCreateCategory,
  findOrCreateCompany,
  findOrCreateLocation,
  getDefaultLocation,
  resolveUnitType,
} from "@/lib/modules/catalog";
import { adjustInventory, bulkSetOnHand, setOnHand } from "@/lib/modules/inventory";
import type { AgentContext } from "../tool";
import { resolveProduct } from "./_helpers";

/**
 * Resolve a bulk "scope" (all / category / vendor / search) to a product filter.
 * Returns an error string the tool surfaces if the named category/vendor is unknown.
 */
async function resolveBulkFilter(
  ctx: AgentContext,
  scope: "all" | "category" | "vendor" | "search",
  scopeValue: string | undefined,
  includeArchived: boolean | undefined,
): Promise<{ filter: BulkProductFilter; label: string } | { error: string }> {
  const base: BulkProductFilter = includeArchived ? {} : { status: "ACTIVE" };
  if (scope === "all")
    return { filter: base, label: includeArchived ? "all products" : "all active products" };
  if (!scopeValue) return { error: `scope_value is required when scope is "${scope}".` };
  if (scope === "category") {
    const c = await findCategoryByName(ctx.service, scopeValue);
    if (!c) return { error: `No category named "${scopeValue}".` };
    return { filter: { ...base, categoryId: c.id }, label: `category "${c.name}"` };
  }
  if (scope === "vendor") {
    const v = await findCompanyByName(ctx.service, scopeValue);
    if (!v) return { error: `No vendor/brand named "${scopeValue}".` };
    return { filter: { ...base, vendorId: v.id }, label: `vendor "${v.name}"` };
  }
  return { filter: { ...base, search: scopeValue }, label: `products matching "${scopeValue}"` };
}

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

export const createProductTool = defineTool({
  name: "create_product",
  description:
    "Create a new product in the catalog. Category and vendor are created if " +
    "they don't exist. Unit type must be a known unit (e.g. Gram, Ounce, Unit).",
  gate: "confirmation",
  inputSchema: z.object({
    name: z.string(),
    sku: z.string(),
    unit_type: z.string().describe("e.g. Gram, Ounce, Unit"),
    category: z.string().optional(),
    vendor: z.string().optional(),
    unit_price: z.number().optional(),
    tracking_method: z.enum(["PACKAGE", "PRODUCT", "BATCH"]).optional(),
    description: z.string().optional(),
  }),
  buildPreview(input) {
    return confirm(
      "Create product",
      `Create "${input.name}" (SKU ${input.sku}).`,
      [
        { label: "Name", value: input.name },
        { label: "SKU", value: input.sku },
        { label: "Unit type", value: input.unit_type },
        { label: "Category", value: input.category ?? "-" },
        { label: "Vendor/Brand", value: input.vendor ?? "-" },
        { label: "Unit price", value: input.unit_price != null ? String(input.unit_price) : "-" },
        { label: "Tracking", value: input.tracking_method ?? "PACKAGE" },
      ],
    );
  },
  async execute(input, ctx) {
    const unit = await resolveUnitType(input.unit_type);
    if (!unit)
      return { ok: false, summary: `Unknown unit type "${input.unit_type}".` };
    const category = input.category
      ? await findOrCreateCategory(ctx.service, input.category)
      : null;
    const vendor = input.vendor
      ? await findOrCreateCompany(ctx.service, input.vendor)
      : null;
    const p = await createProduct(ctx.service, {
      name: input.name,
      sku: input.sku,
      unitTypeId: unit.id,
      categoryId: category?.id ?? null,
      vendorId: vendor?.id ?? null,
      unitPrice: input.unit_price ?? null,
      inventoryTrackingMethod: input.tracking_method ?? "PACKAGE",
      description: input.description ?? null,
    });
    return {
      ok: true,
      summary: `Created ${p.product.name} (SKU ${p.product.sku}).`,
      data: { id: p.product.id, sku: p.product.sku },
    };
  },
});

export const updateProductTool = defineTool({
  name: "update_product",
  description:
    "Update fields on an existing product. Identify it by SKU or id. Only " +
    "provided fields change.",
  gate: "confirmation",
  inputSchema: z.object({
    sku: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    new_sku: z.string().optional(),
    unit_type: z.string().optional(),
    category: z.string().optional(),
    vendor: z.string().optional(),
    unit_price: z.number().optional(),
    tracking_method: z.enum(["PACKAGE", "PRODUCT", "BATCH"]).optional(),
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  }),
  async buildPreview(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    const changes: { label: string; value: string }[] = [];
    if (input.name) changes.push({ label: "Name", value: input.name });
    if (input.new_sku) changes.push({ label: "SKU", value: input.new_sku });
    if (input.unit_type) changes.push({ label: "Unit type", value: input.unit_type });
    if (input.category) changes.push({ label: "Category", value: input.category });
    if (input.vendor) changes.push({ label: "Vendor/Brand", value: input.vendor });
    if (input.unit_price != null) changes.push({ label: "Unit price", value: String(input.unit_price) });
    if (input.tracking_method) changes.push({ label: "Tracking", value: input.tracking_method });
    if (input.status) changes.push({ label: "Status", value: input.status });
    if (input.description) changes.push({ label: "Description", value: input.description });
    return confirm(
      "Update product",
      p ? `Update "${p.product.name}" (SKU ${p.product.sku}).` : "Update product.",
      changes.length ? changes : [{ label: "Changes", value: "(none)" }],
    );
  },
  async execute(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    if (!p) return { ok: false, summary: "No matching product found." };
    const unit = input.unit_type ? await resolveUnitType(input.unit_type) : undefined;
    if (input.unit_type && !unit)
      return { ok: false, summary: `Unknown unit type "${input.unit_type}".` };
    const category = input.category
      ? await findOrCreateCategory(ctx.service, input.category)
      : undefined;
    const vendor = input.vendor
      ? await findOrCreateCompany(ctx.service, input.vendor)
      : undefined;
    const updated = await updateProduct(ctx.service, p.product.id, {
      name: input.name,
      sku: input.new_sku,
      unitTypeId: unit?.id,
      categoryId: category?.id,
      vendorId: vendor?.id,
      unitPrice: input.unit_price,
      inventoryTrackingMethod: input.tracking_method,
      description: input.description,
      status: input.status,
    });
    return {
      ok: true,
      summary: `Updated ${updated.product.name} (SKU ${updated.product.sku}).`,
      data: { id: updated.product.id },
    };
  },
});

export const archiveProductTool = defineTool({
  name: "archive_product",
  description: "Archive a product (soft delete). Identify by SKU or id.",
  gate: "confirmation",
  inputSchema: z.object({
    sku: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    return confirm(
      "Archive product",
      p ? `Archive "${p.product.name}" (SKU ${p.product.sku})?` : "Archive product?",
      [{ label: "Product", value: p ? `${p.product.name} (${p.product.sku})` : "?" }],
      "high",
    );
  },
  async execute(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    if (!p) return { ok: false, summary: "No matching product found." };
    await archiveProduct(ctx.service, p.product.id);
    return { ok: true, summary: `Archived ${p.product.name}.` };
  },
});

export const adjustInventoryTool = defineTool({
  name: "adjust_inventory",
  description:
    "Adjust on-hand inventory for a product by a relative delta (positive to " +
    "add, negative to remove). Uses the default location unless one is given.",
  gate: "confirmation",
  inputSchema: z.object({
    sku: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    delta: z.number(),
    location: z.string().optional(),
    reason: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    return confirm(
      "Adjust inventory",
      p
        ? `${input.delta >= 0 ? "Add" : "Remove"} ${Math.abs(input.delta)} to "${p.product.name}".`
        : "Adjust inventory.",
      [
        { label: "Product", value: p ? p.product.name : "?" },
        { label: "Change", value: `${input.delta >= 0 ? "+" : ""}${input.delta}` },
        { label: "Location", value: input.location ?? "default" },
        { label: "Reason", value: input.reason ?? "adjustment" },
      ],
    );
  },
  async execute(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    if (!p) return { ok: false, summary: "No matching product found." };
    const location = input.location
      ? await findOrCreateLocation(ctx.service, input.location)
      : await getDefaultLocation(ctx.service);
    const { onHand } = await adjustInventory(ctx.service, {
      productId: p.product.id,
      locationId: location.id,
      delta: input.delta,
      reason: input.reason,
    });
    return {
      ok: true,
      summary: `${p.product.name} at ${location.name}: now ${onHand} on hand.`,
      data: { on_hand: onHand, location: location.name },
    };
  },
});

export const setOnHandTool = defineTool({
  name: "set_on_hand",
  description:
    "Set a product's on-hand quantity at a location to an absolute value.",
  gate: "confirmation",
  inputSchema: z.object({
    sku: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    quantity: z.number(),
    location: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    return confirm(
      "Set on-hand quantity",
      p ? `Set "${p.product.name}" on-hand to ${input.quantity}.` : "Set on-hand.",
      [
        { label: "Product", value: p ? p.product.name : "?" },
        { label: "Target quantity", value: String(input.quantity) },
        { label: "Location", value: input.location ?? "default" },
      ],
    );
  },
  async execute(input, ctx) {
    const p = await resolveProduct(ctx.service, input);
    if (!p) return { ok: false, summary: "No matching product found." };
    const location = input.location
      ? await findOrCreateLocation(ctx.service, input.location)
      : await getDefaultLocation(ctx.service);
    const { onHand } = await setOnHand(ctx.service, {
      productId: p.product.id,
      locationId: location.id,
      target: input.quantity,
    });
    return {
      ok: true,
      summary: `${p.product.name} at ${location.name}: now ${onHand} on hand.`,
      data: { on_hand: onHand },
    };
  },
});

export const createCategoryTool = defineTool({
  name: "create_category",
  description: "Create a new product category.",
  gate: "confirmation",
  inputSchema: z.object({ name: z.string() }),
  buildPreview(input) {
    return confirm("Create category", `Create category "${input.name}".`, [
      { label: "Name", value: input.name },
    ], "low");
  },
  async execute(input, ctx) {
    const c = await createCategory(ctx.service, { name: input.name });
    return { ok: true, summary: `Created category ${c.name}.`, data: { id: c.id } };
  },
});

export const createVendorTool = defineTool({
  name: "create_vendor",
  description: "Create a new company that can act as a vendor/brand.",
  gate: "confirmation",
  inputSchema: z.object({
    name: z.string(),
    roles: z.array(z.enum(["VENDOR", "BRAND", "CUSTOMER"])).optional(),
  }),
  buildPreview(input) {
    return confirm("Create company", `Create company "${input.name}".`, [
      { label: "Name", value: input.name },
      { label: "Roles", value: (input.roles ?? ["VENDOR", "BRAND"]).join(", ") },
    ], "low");
  },
  async execute(input, ctx) {
    const c = await createCompany(ctx.service, { name: input.name, roles: input.roles });
    return { ok: true, summary: `Created company ${c.name}.`, data: { id: c.id } };
  },
});

const bulkScope = z.object({
  scope: z
    .enum(["all", "category", "vendor", "search"])
    .describe("Which products to affect. Use this instead of updating one at a time."),
  scope_value: z
    .string()
    .optional()
    .describe("Category name, vendor/brand name, or search text. Required unless scope is 'all'."),
  include_archived: z
    .boolean()
    .optional()
    .describe("Include archived products (default false: active only)."),
});

export const bulkUpdateProductsTool = defineTool({
  name: "bulk_update_products",
  description:
    "Update the same field(s) on MANY products at once in a single approval - " +
    "e.g. 'set every product's price to 1000', or 'archive all products from vendor X'. " +
    "Prefer this over calling update_product repeatedly. Choose the products with " +
    "scope (all / category / vendor / search) and provide the fields to set.",
  gate: "confirmation",
  inputSchema: bulkScope.extend({
    set: z
      .object({
        unit_price: z.number().optional(),
        category: z.string().optional(),
        vendor: z.string().optional(),
        tracking_method: z.enum(["PACKAGE", "PRODUCT", "BATCH"]).optional(),
        status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
      })
      .describe("Fields to set on every matched product."),
  }),
  async buildPreview(input, ctx) {
    const r = await resolveBulkFilter(ctx, input.scope, input.scope_value, input.include_archived);
    if ("error" in r) return confirm("Bulk update products", r.error, [], "high");
    const n = await countProducts(ctx.service, r.filter);
    const changes: { label: string; value: string }[] = [];
    if (input.set.unit_price != null)
      changes.push({ label: "Unit price", value: `$${input.set.unit_price}` });
    if (input.set.category) changes.push({ label: "Category", value: input.set.category });
    if (input.set.vendor) changes.push({ label: "Vendor/Brand", value: input.set.vendor });
    if (input.set.tracking_method)
      changes.push({ label: "Tracking", value: input.set.tracking_method });
    if (input.set.status) changes.push({ label: "Status", value: input.set.status });
    return confirm(
      "Bulk update products",
      `Update ${n} product${n === 1 ? "" : "s"} (${r.label}).`,
      [{ label: "Scope", value: r.label }, { label: "Products", value: String(n) }, ...changes],
      "high",
    );
  },
  async execute(input, ctx) {
    const r = await resolveBulkFilter(ctx, input.scope, input.scope_value, input.include_archived);
    if ("error" in r) return { ok: false, summary: r.error };
    const set: ProductInput = {};
    if (input.set.unit_price != null) set.unitPrice = input.set.unit_price;
    if (input.set.tracking_method) set.inventoryTrackingMethod = input.set.tracking_method;
    if (input.set.status) set.status = input.set.status;
    if (input.set.category)
      set.categoryId = (await findOrCreateCategory(ctx.service, input.set.category)).id;
    if (input.set.vendor)
      set.vendorId = (await findOrCreateCompany(ctx.service, input.set.vendor)).id;
    if (Object.keys(set).length === 0)
      return { ok: false, summary: "Nothing to change; specify at least one field in set." };
    const { updated } = await bulkUpdateProducts(ctx.service, { filter: r.filter, set });
    return {
      ok: true,
      summary: `Updated ${updated} product${updated === 1 ? "" : "s"} (${r.label}).`,
      data: { updated },
    };
  },
});

export const bulkSetOnHandTool = defineTool({
  name: "bulk_set_on_hand",
  description:
    "Set on-hand quantity to the same value for MANY products at once, in a single " +
    "approval - e.g. 'set on-hand to 0 for every product in category Flower'. " +
    "Choose the products with scope; one ledger movement is posted per product.",
  gate: "confirmation",
  inputSchema: bulkScope.extend({
    quantity: z.number().describe("Absolute on-hand target for every matched product."),
    location: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const r = await resolveBulkFilter(ctx, input.scope, input.scope_value, input.include_archived);
    if ("error" in r) return confirm("Bulk set on-hand", r.error, [], "high");
    const n = await countProducts(ctx.service, r.filter);
    return confirm(
      "Bulk set on-hand",
      `Set on-hand to ${input.quantity} for ${n} product${n === 1 ? "" : "s"} (${r.label}).`,
      [
        { label: "Scope", value: r.label },
        { label: "Products", value: String(n) },
        { label: "Target quantity", value: String(input.quantity) },
        { label: "Location", value: input.location ?? "default" },
      ],
      "high",
    );
  },
  async execute(input, ctx) {
    const r = await resolveBulkFilter(ctx, input.scope, input.scope_value, input.include_archived);
    if ("error" in r) return { ok: false, summary: r.error };
    const ids = await productIdsMatching(ctx.service, r.filter);
    if (ids.length === 0) return { ok: false, summary: `No products match ${r.label}.` };
    const location = input.location
      ? await findOrCreateLocation(ctx.service, input.location)
      : await getDefaultLocation(ctx.service);
    const { updated } = await bulkSetOnHand(ctx.service, {
      productIds: ids,
      locationId: location.id,
      target: input.quantity,
    });
    return {
      ok: true,
      summary: `Set on-hand to ${input.quantity} for ${updated} product${updated === 1 ? "" : "s"} at ${location.name}.`,
      data: { updated },
    };
  },
});

export const mutationTools = [
  createProductTool,
  updateProductTool,
  archiveProductTool,
  adjustInventoryTool,
  setOnHandTool,
  bulkUpdateProductsTool,
  bulkSetOnHandTool,
  createCategoryTool,
  createVendorTool,
];
