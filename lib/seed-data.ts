import { db } from "@/db";
import { unitTypes } from "@/db/schema";
import { systemCtx } from "@/lib/modules/shared";
import {
  _resetUnitTypeCache,
  findOrCreateCompany,
  getDefaultLocation,
} from "@/lib/modules/catalog";
import { upsertProduct } from "@/lib/modules/catalog";
import { resolveUnitType } from "@/lib/modules/catalog";
import { findOrCreateCategory } from "@/lib/modules/catalog";
import { adjustInventory, getOnHand } from "@/lib/modules/inventory";
import { createWorkflow, listWorkflows } from "@/lib/harness/workflows";
import { getProductBySku } from "@/lib/modules/catalog";
import { findOrCreateCustomer } from "@/lib/modules/catalog";
import { createOrder, listOrders } from "@/lib/modules/sales";
import { createInvoiceForOrder, recordPayment } from "@/lib/modules/sales";

const UNIT_TYPES: { name: string; kind: "WEIGHT" | "VOLUME" | "COUNT" }[] = [
  { name: "Gram", kind: "WEIGHT" },
  { name: "Kilogram", kind: "WEIGHT" },
  { name: "Milligram", kind: "WEIGHT" },
  { name: "Ounce", kind: "WEIGHT" },
  { name: "Pound", kind: "WEIGHT" },
  { name: "Milliliter", kind: "VOLUME" },
  { name: "Liter", kind: "VOLUME" },
  { name: "Gallon", kind: "VOLUME" },
  { name: "Pint", kind: "VOLUME" },
  { name: "Quart", kind: "VOLUME" },
  { name: "Fluid Ounce", kind: "VOLUME" },
  { name: "Unit", kind: "COUNT" },
];

/** Insert the global unit-type reference set (idempotent). */
export async function seedUnitTypes() {
  await db
    .insert(unitTypes)
    .values(UNIT_TYPES.map((u) => ({ name: u.name, measurementKind: u.kind })))
    .onConflictDoNothing();
  _resetUnitTypeCache();
}

const SAMPLE_PRODUCTS: {
  name: string;
  sku: string;
  category: string;
  vendor: string;
  unit: string;
  price: number;
  tracking?: "PACKAGE" | "PRODUCT" | "BATCH";
  onHand: number;
}[] = [
  { name: "Blue Dream 3.5g", sku: "FL-BD-35", category: "Flower", vendor: "Sungrown Farms", unit: "Gram", price: 25, onHand: 120 },
  { name: "OG Kush 3.5g", sku: "FL-OG-35", category: "Flower", vendor: "Sungrown Farms", unit: "Gram", price: 30, onHand: 80 },
  { name: "Granddaddy Purple 3.5g", sku: "FL-GDP-35", category: "Flower", vendor: "Sungrown Farms", unit: "Gram", price: 28, onHand: 64 },
  { name: "Wedding Cake 3.5g", sku: "FL-WC-35", category: "Flower", vendor: "Sungrown Farms", unit: "Gram", price: 32, onHand: 40 },
  { name: "Sour Diesel Pre-Roll 1g", sku: "PR-SD-1", category: "Pre-Rolls", vendor: "Kush Co", unit: "Unit", price: 8, onHand: 200 },
  { name: "Watermelon Gummies 100mg", sku: "ED-GUM-100", category: "Edibles", vendor: "Cloud9 Labs", unit: "Unit", price: 18, onHand: 150 },
  { name: "Dark Chocolate Bar 100mg", sku: "ED-CHOC-100", category: "Edibles", vendor: "Cloud9 Labs", unit: "Unit", price: 20, onHand: 90 },
  { name: "CBD Tincture 30ml", sku: "ED-TINC-30", category: "Edibles", vendor: "Cloud9 Labs", unit: "Milliliter", price: 45, onHand: 35 },
  { name: "Live Resin Cart 1g", sku: "VP-LR-1", category: "Vapes", vendor: "Cloud9 Labs", unit: "Gram", price: 40, onHand: 75 },
  { name: "Disposable Vape 0.5g", sku: "VP-DISP-05", category: "Vapes", vendor: "Cloud9 Labs", unit: "Gram", price: 35, onHand: 110 },
  { name: "Shatter 1g", sku: "CN-SH-1", category: "Concentrates", vendor: "Kush Co", unit: "Gram", price: 30, onHand: 50 },
  { name: "Live Rosin 1g", sku: "CN-RS-1", category: "Concentrates", vendor: "Kush Co", unit: "Gram", price: 60, onHand: 25 },
];

/** Seed a brand-new org with a realistic starter catalog + inventory. */
export async function provisionOrgSampleData(orgId: string) {
  await seedUnitTypes();
  const ctx = systemCtx(orgId);
  const location = await getDefaultLocation(ctx);

  // Warm reference caches / create vendors + categories.
  const vendors = ["Sungrown Farms", "Kush Co", "Cloud9 Labs"];
  for (const v of vendors) await findOrCreateCompany(ctx, v);

  for (const p of SAMPLE_PRODUCTS) {
    const unit = await resolveUnitType(p.unit);
    const category = await findOrCreateCategory(ctx, p.category);
    const vendor = await findOrCreateCompany(ctx, p.vendor);
    const { product } = await upsertProduct(ctx, {
      name: p.name,
      sku: p.sku,
      unitTypeId: unit?.id ?? null,
      categoryId: category.id,
      vendorId: vendor.id,
      unitPrice: p.price,
      inventoryTrackingMethod: p.tracking ?? "PACKAGE",
    });
    const current = await getOnHand(ctx, product.product.id, location.id);
    if (current === 0 && p.onHand > 0) {
      await adjustInventory(ctx, {
        productId: product.product.id,
        locationId: location.id,
        delta: p.onHand,
        reason: "opening balance",
      });
    }
  }

  // A sample automation so the Automations page is discoverable out of the box.
  if ((await listWorkflows(ctx)).length === 0) {
    await createWorkflow(ctx, {
      name: "Low-stock report",
      instruction:
        "Find every active product with on-hand below 25 units and list them " +
        "with their SKU and current on-hand, lowest first. This is a read-only " +
        "report; do not change any data.",
      trigger: "manual",
    });
  }

  // A couple of sample sales orders + an invoice so the Sales page isn't empty.
  if ((await listOrders(ctx)).items.length === 0) {
    await seedSampleOrders(ctx);
  }
}

/** Seed two confirmed orders (decrementing stock) and one paid-in-part invoice. */
async function seedSampleOrders(ctx: ReturnType<typeof systemCtx>) {
  const lineFor = async (sku: string, quantity: number) => {
    const p = await getProductBySku(ctx, sku);
    if (!p) return null;
    return {
      productId: p.product.id,
      sku: p.product.sku,
      name: p.product.name,
      quantity,
      unitPrice: Number(p.product.unitPrice ?? 0),
    };
  };

  const greenLeaf = await findOrCreateCustomer(ctx, "Green Leaf Dispensary");
  const l1 = [await lineFor("FL-BD-35", 10), await lineFor("FL-OG-35", 5)].filter((x) => x != null);
  if (l1.length) {
    const order = await createOrder(ctx, {
      customerId: greenLeaf.id,
      status: "COMPLETED",
      items: l1 as NonNullable<(typeof l1)[number]>[],
    });
    const invoice = await createInvoiceForOrder(ctx, order.order.id);
    await recordPayment(ctx, invoice.invoice.id, { amount: Math.round(order.total / 2), method: "ach" });
  }

  const highDesert = await findOrCreateCustomer(ctx, "High Desert Collective");
  const l2 = [await lineFor("VP-LR-1", 12), await lineFor("ED-GUM-100", 20)].filter((x) => x != null);
  if (l2.length) {
    await createOrder(ctx, {
      customerId: highDesert.id,
      status: "PROCESSING",
      items: l2 as NonNullable<(typeof l2)[number]>[],
    });
  }
}
