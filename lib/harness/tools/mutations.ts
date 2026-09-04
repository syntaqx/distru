import { z } from "zod";
import { defineTool } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  archiveProduct,
  createProduct,
  updateProduct,
} from "@/lib/services/products";
import {
  createCategory,
  createCompany,
  findOrCreateCategory,
  findOrCreateCompany,
  findOrCreateLocation,
  getDefaultLocation,
  resolveUnitType,
} from "@/lib/services/reference";
import { adjustInventory, setOnHand } from "@/lib/services/inventory";
import { resolveProduct } from "./_helpers";

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

export const mutationTools = [
  createProductTool,
  updateProductTool,
  archiveProductTool,
  adjustInventoryTool,
  setOnHandTool,
  createCategoryTool,
  createVendorTool,
];
