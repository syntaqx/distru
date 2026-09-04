import { z } from "zod";
import { defineTool } from "../tool";
import {
  getProduct,
  getProductBySku,
  listProducts,
} from "@/lib/services/products";
import {
  listCategories,
  listCompanies,
  listLocations,
} from "@/lib/services/reference";
import { getOnHand, onHandByProduct } from "@/lib/services/inventory";
import { productSummary, resolveProduct } from "./_helpers";

export const searchProducts = defineTool({
  name: "search_products",
  description:
    "Search the org's product catalog by name or SKU, with optional category, " +
    "vendor, and status filters. Returns compact product summaries.",
  gate: "none",
  inputSchema: z.object({
    query: z.string().optional().describe("name or SKU fragment"),
    category: z.string().optional(),
    vendor: z.string().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async execute(input, ctx) {
    const cats = input.category ? await listCategories(ctx.service) : [];
    const vendors = input.vendor ? await listCompanies(ctx.service) : [];
    const categoryId = input.category
      ? cats.find((c) => c.name.toLowerCase() === input.category!.toLowerCase())?.id
      : undefined;
    const vendorId = input.vendor
      ? vendors.find((v) => v.name.toLowerCase() === input.vendor!.toLowerCase())?.id
      : undefined;
    const { items, total } = await listProducts(ctx.service, {
      search: input.query,
      categoryId,
      vendorId,
      status: input.status,
      limit: input.limit ?? 25,
    });
    return {
      ok: true,
      summary: `Found ${total} product(s)${input.query ? ` matching "${input.query}"` : ""}; showing ${items.length}.`,
      data: { total, products: items.map(productSummary) },
    };
  },
});

export const getProductTool = defineTool({
  name: "get_product",
  description:
    "Get full details for one product, including on-hand inventory. Identify it " +
    "by SKU, id, or name.",
  gate: "none",
  inputSchema: z.object({
    sku: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
  }),
  async execute(input, ctx) {
    const p =
      (input.id && (await getProduct(ctx.service, input.id))) ||
      (input.sku && (await getProductBySku(ctx.service, input.sku))) ||
      (await resolveProduct(ctx.service, input));
    if (!p) return { ok: false, summary: "No matching product found." };
    const onHand = await getOnHand(ctx.service, p.product.id);
    return {
      ok: true,
      summary: `${p.product.name} (SKU ${p.product.sku}) - on hand ${onHand}.`,
      data: { ...productSummary(p), description: p.product.description, on_hand: onHand },
    };
  },
});

export const listCategoriesTool = defineTool({
  name: "list_categories",
  description: "List all product categories in the org.",
  gate: "none",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const cats = await listCategories(ctx.service);
    return {
      ok: true,
      summary: `${cats.length} categories.`,
      data: { categories: cats.map((c) => c.name) },
    };
  },
});

export const listVendorsTool = defineTool({
  name: "list_vendors",
  description: "List companies that can be a product's vendor/brand.",
  gate: "none",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const vendors = await listCompanies(ctx.service);
    return {
      ok: true,
      summary: `${vendors.length} companies.`,
      data: { companies: vendors.map((v) => ({ name: v.name, roles: v.roles })) },
    };
  },
});

export const listLocationsTool = defineTool({
  name: "list_locations",
  description: "List inventory locations (warehouses) in the org.",
  gate: "none",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const locs = await listLocations(ctx.service);
    return {
      ok: true,
      summary: `${locs.length} locations.`,
      data: { locations: locs.map((l) => l.name) },
    };
  },
});

export const inventoryReport = defineTool({
  name: "inventory_report",
  description:
    "Report on-hand inventory. With no product, returns totals for the catalog; " +
    "with a product (sku/name/id), returns that product's on-hand.",
  gate: "none",
  inputSchema: z.object({
    sku: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  async execute(input, ctx) {
    if (input.sku || input.id || input.name) {
      const p = await resolveProduct(ctx.service, input);
      if (!p) return { ok: false, summary: "No matching product found." };
      const onHand = await getOnHand(ctx.service, p.product.id);
      return {
        ok: true,
        summary: `${p.product.name}: ${onHand} on hand.`,
        data: { product: p.product.name, sku: p.product.sku, on_hand: onHand },
      };
    }
    const map = await onHandByProduct(ctx.service);
    const { items } = await listProducts(ctx.service, {
      limit: input.limit ?? 50,
    });
    const report = items.map((p) => ({
      name: p.product.name,
      sku: p.product.sku,
      on_hand: map.get(p.product.id) ?? 0,
    }));
    const totalUnits = [...map.values()].reduce((a, b) => a + b, 0);
    return {
      ok: true,
      summary: `${report.length} products, ${totalUnits} total units on hand.`,
      data: { total_units: totalUnits, products: report },
    };
  },
});

export const catalogTools = [
  searchProducts,
  getProductTool,
  listCategoriesTool,
  listVendorsTool,
  listLocationsTool,
  inventoryReport,
];
