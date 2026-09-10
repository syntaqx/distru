import { eq } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, unitTypes, user, workflowRuns, workflows } from "@/db/schema";
import { auth } from "@/lib/auth";
import { systemCtx } from "@/lib/modules/shared";
import { listProducts } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";
import {
  createArtifact,
  formatReport,
  listArtifacts,
  runReport,
} from "@/lib/modules/reports";
import { createNotification } from "@/lib/modules/notifications";
import { getConnection, runMockSync } from "@/lib/modules/platform";
import { listOrgMembers, listTasks, upsertTask } from "@/lib/modules/platform";
import { ensureDriverProfile, upsertMembership } from "@/lib/modules/platform";
import {
  _resetUnitTypeCache,
  findOrCreateCompany,
  getDefaultLocation,
} from "@/lib/modules/catalog";
import { upsertProduct } from "@/lib/modules/catalog";
import { resolveUnitType } from "@/lib/modules/catalog";
import { findOrCreateCategory } from "@/lib/modules/catalog";
import {
  createTransfer,
  getOnHand,
  listPackages,
  listTransfers,
  receiveStock,
  upsertPackage,
} from "@/lib/modules/inventory";
import {
  expiringLicenses,
  getPackageTestResult,
  listLicenses,
  upsertLicense,
  upsertTestResult,
} from "@/lib/modules/compliance";
import { listAssemblies, upsertAssembly, upsertCost, upsertCostType } from "@/lib/modules/manufacturing";
import { findOrCreateLocation } from "@/lib/modules/catalog";
import { createWorkflow, listWorkflows } from "@/lib/harness/workflows";
import { getProductBySku } from "@/lib/modules/catalog";
import { findOrCreateCustomer } from "@/lib/modules/catalog";
import { addCompanyNote, listCompanyNotes } from "@/lib/modules/catalog";
import { createOrder, listOrders } from "@/lib/modules/sales";
import {
  advanceDeliveryStatus,
  AUSTIN_DEPOT,
  createDeliveryFromOrder,
  getTelemetryByVehicle,
  listDeliveries,
  listDrivers,
  listVehicles,
  upsertDriver,
  upsertRoute,
  upsertTelemetry,
  upsertVehicle,
} from "@/lib/modules/logistics";
import { createInvoiceForOrder, recordPayment } from "@/lib/modules/sales";
import { listStrains, upsertStrain } from "@/lib/modules/catalog";
import {
  listPlantBatches,
  listPlantEvents,
  logPlantEvent,
  upsertPlantBatch,
  upsertPlant,
  upsertHarvest,
} from "@/lib/modules/cultivation";

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

/** Deterministic small hash for stable fake barcodes/serials/tags from a string. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

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
    // Standard cost at ~55% of wholesale price, so gross margin and COGS are real.
    const cost = Math.round(p.price * 0.55 * 100) / 100;
    const { product } = await upsertProduct(ctx, {
      name: p.name,
      sku: p.sku,
      unitTypeId: unit?.id ?? null,
      categoryId: category.id,
      vendorId: vendor.id,
      unitPrice: p.price,
      unitCost: cost,
      barcode: `840${String(Math.abs(hashString(p.sku)) % 1_000_000_000).padStart(9, "0")}`,
      inventoryTrackingMethod: p.tracking ?? "PACKAGE",
    });
    const current = await getOnHand(ctx, product.product.id, location.id);
    if (current === 0 && p.onHand > 0) {
      // Opening balance as a real FIFO cost layer at the standard cost.
      await receiveStock(ctx, {
        productId: product.product.id,
        locationId: location.id,
        qty: p.onHand,
        unitCost: cost,
        sourceType: "OPENING",
        reason: "opening balance",
      });
    }
  }

  // The transactional inventory showcase: a second location, Metrc-tagged
  // packages with COAs, a completed manufacturing run, and a stock transfer.
  await seedOperationsShowcase(ctx);

  // A sample automation so the Automations canvas is discoverable out of the box:
  // a scheduled trigger -> an AI-agent node with an inventory tool wired into it.
  if ((await listWorkflows(ctx)).length === 0) {
    const instruction =
      "Find every active product with on-hand below 25 units and list them with " +
      "their SKU and current on-hand, lowest first, as a markdown table. Then call " +
      "save_report to save it (title 'Low-stock report - <today>'). Read-only; do " +
      "not change any data. If an email recipient is configured, email it with email_report.";
    await createWorkflow(ctx, {
      name: "Low-stock report",
      instruction,
      graph: {
        nodes: [
          {
            id: "trigger",
            type: "trigger.schedule",
            name: "Every morning",
            params: { cron: "0 8 * * *", description: "Every day at 8:00am" },
            position: { x: 80, y: 160 },
          },
          {
            id: "agent",
            type: "agent",
            name: "Low-stock agent",
            params: { instruction, maxSteps: 8 },
            position: { x: 360, y: 160 },
          },
          {
            id: "tool_inv",
            type: "tool",
            name: "inventory_report",
            params: { tool: "inventory_report" },
            position: { x: 360, y: 380 },
          },
          {
            id: "tool_save",
            type: "tool",
            name: "save_report",
            params: { tool: "save_report" },
            position: { x: 520, y: 380 },
          },
        ],
        connections: {
          trigger: { main: [[{ node: "agent" }]] },
          tool_inv: { ai_tool: [[{ node: "agent" }]] },
          tool_save: { ai_tool: [[{ node: "agent" }]] },
        },
      },
    });
  }

  // A couple of sample sales orders + an invoice so the Sales page isn't empty.
  if ((await listOrders(ctx)).items.length === 0) {
    await seedSampleOrders(ctx);
  }

  // A few CRM sales notes so the company timeline isn't empty.
  await seedCrm(ctx);

  // A starter grow so the Cultivation module isn't empty.
  if ((await listPlantBatches(ctx)).items.length === 0) {
    await seedCultivation(ctx);
  }

  // Real people: a handful of login-capable team members with additive roles
  // (one is both admin AND driver), plus driver profiles for the folks who run
  // deliveries. Seeded BEFORE deliveries/dispatch so those steps reuse these
  // driver records by name (and inherit the user link + login).
  await seedTeam(ctx);

  // A few deliveries across statuses (with a driver, vehicle, and a day's route)
  // so the Fleet -> Deliveries board and driver manifest aren't empty.
  if ((await listDeliveries(ctx, { limit: 1 })).items.length === 0) {
    await seedDeliveries(ctx);
  }

  // The live DISPATCH day: an Austin depot, two vans on the road with telemetry,
  // today's stops mid-route + delivered, and tomorrow's assigned run. Idempotent
  // (guards on there being no telemetry yet); relative dates keep every reseed a
  // fresh operating day.
  await seedDispatch(ctx);

  // A handful of sample tasks so the Calendar & Tasks page isn't empty.
  await seedTasks(ctx);

  // Showcase: pre-made Reports, a completed automation run, and notifications,
  // so Reports / Automations history / the bell all feel lived-in on a fresh reset.
  await seedShowcase(ctx);

  // Mark a couple of integrations connected with real sync events, so the
  // Integrations screen looks alive out of the box.
  await seedIntegrations(ctx);

  // A couple of upcoming planned/in-progress production runs (with an active
  // stock reservation) so the Manufacturing schedule view isn't empty.
  await seedScheduledAssemblies(ctx);

  // Grow + compliance depth: a plant-event timeline, a lot-level COA with
  // structured potency, and an expiring license to drive the compliance alert.
  await seedGrowCompliance(ctx);
}

/**
 * Seed a couple of forward-looking manufacturing runs so the production
 * schedule is populated: one PENDING run planned for a few days out, and one
 * IN_PROGRESS run whose inputs are soft-reserved. Idempotent: skips once any
 * scheduled assembly exists.
 */
async function seedScheduledAssemblies(ctx: ReturnType<typeof systemCtx>) {
  const { items } = await listAssemblies(ctx, { limit: 200 });
  if (items.some((a) => a.scheduledStart != null)) return;

  const main = await getDefaultLocation(ctx);
  const flowerOg = await getProductBySku(ctx, "FL-OG-35");
  const flowerGdp = await getProductBySku(ctx, "FL-GDP-35");
  const preroll = await getProductBySku(ctx, "PR-SD-1");
  if (!preroll) return;

  const day = 864e5;
  const at = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * day);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  // Planned (PENDING) run a few days out - visible on the schedule, no hold yet.
  if (flowerGdp) {
    await upsertAssembly(ctx, {
      status: "PENDING",
      locationId: main.id,
      notes: "Planned: Granddaddy Purple pre-roll batch",
      scheduledStart: at(3, 9),
      scheduledEnd: at(3, 13),
      estimatedWorkMinutes: 240,
      assignedTo: "Rolling Team A",
      inputs: [{ productId: flowerGdp.product.id, quantity: 25 }],
      outputs: [{ productId: preroll.product.id, quantity: 16 }],
    });
  }

  // In-progress run scheduled for tomorrow - moving to IN_PROGRESS reserves its
  // input stock (a soft hold) via the manufacturing service.
  if (flowerOg) {
    await upsertAssembly(ctx, {
      status: "IN_PROGRESS",
      locationId: main.id,
      notes: "Active: OG Kush pre-roll batch",
      scheduledStart: at(1, 8),
      scheduledEnd: at(1, 12),
      estimatedWorkMinutes: 180,
      assignedTo: "Rolling Team B",
      inputs: [{ productId: flowerOg.product.id, quantity: 20 }],
      outputs: [{ productId: preroll.product.id, quantity: 12 }],
    });
  }
}

/**
 * Mark QuickBooks + Metrc as connected and run a mock sync for each, so the
 * Integrations settings screen shows connected providers, last-synced times, and
 * a populated sync-activity feed. Idempotent: skips once a connection exists.
 */
async function seedIntegrations(ctx: ReturnType<typeof systemCtx>) {
  if (await getConnection(ctx, "quickbooks")) return;
  await runMockSync(ctx, "quickbooks");
  await runMockSync(ctx, "metrc");
}

/**
 * Seed a few sample tasks with varied statuses, priorities, and due dates - some
 * linked to a company/order - so the Calendar & Tasks board and month grid feel
 * lived-in. Idempotent: skips if any tasks already exist.
 */
async function seedTasks(ctx: ReturnType<typeof systemCtx>) {
  if ((await listTasks(ctx, { limit: 1 })).items.length > 0) return;

  const members = await listOrgMembers(ctx);
  const owner = members[0]?.id ?? null;
  const greenLeaf = await findOrCreateCustomer(ctx, "Green Leaf Dispensary");
  const recentOrder = (await listOrders(ctx, { limit: 1 })).items[0]?.order ?? null;

  const day = (offset: number) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return d;
  };

  const seeds: Parameters<typeof upsertTask>[1][] = [
    {
      title: "Call Green Leaf about reorder",
      description: "Confirm next month's flower quantities and delivery window.",
      status: "OPEN",
      priority: "HIGH",
      dueAt: day(1),
      assigneeId: owner,
      entityType: "company",
      entityId: greenLeaf.id,
    },
    {
      title: "Restock low pre-rolls",
      description: "Pre-roll inventory is running low - schedule a production run.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueAt: day(3),
      assigneeId: owner,
    },
    {
      title: "Renew High Desert license",
      description: "Their license expires soon - collect updated paperwork.",
      status: "OPEN",
      priority: "HIGH",
      dueAt: day(-1),
      assigneeId: owner,
    },
    {
      title: "Reconcile last week's invoices",
      status: "DONE",
      priority: "LOW",
      dueAt: day(-4),
      assigneeId: owner,
    },
    {
      title: "Update product photos",
      description: "Refresh catalog imagery for the new vape line.",
      status: "OPEN",
      priority: "LOW",
      assigneeId: owner,
    },
    {
      title: "Fulfill order",
      description: "Pick, pack, and schedule delivery.",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      dueAt: day(2),
      assigneeId: owner,
      ...(recentOrder ? { entityType: "order", entityId: recentOrder.id } : {}),
    },
  ];

  for (const s of seeds) await upsertTask(ctx, s);
}

/**
 * Generate real Report artifacts from the seeded data (via the report registry -
 * no LLM), attach one to a completed run of the Low-stock automation, and drop a
 * few notifications. Idempotent: skips if any artifacts already exist.
 */
async function seedShowcase(ctx: ReturnType<typeof systemCtx>) {
  if ((await listArtifacts(ctx, { limit: 1 })).length > 0) return;
  const today = new Date().toISOString().slice(0, 10);

  // Two rich snapshot reports from the standard registry.
  for (const spec of [
    { name: "sales-by-product", label: "Sales by product" },
    { name: "inventory-valuation", label: "Inventory valuation" },
  ]) {
    const r = await runReport(ctx, spec.name);
    if (!r) continue;
    const art = await createArtifact(ctx, {
      title: `${spec.label} - ${today}`,
      content: formatReport(r.columns, r.rows, "markdown"),
      kind: "report",
      format: "markdown",
    });
    await createNotification(ctx, {
      userId: null,
      kind: "report.ready",
      title: `Report ready: ${art.title}`,
      href: `/reports?id=${art.id}`,
    });
  }

  // A "Low-stock report" (the five lowest-stocked products) attached to a
  // completed run of the seeded Low-stock automation - as if the 8am schedule
  // fired this morning.
  const { items } = await listProducts(ctx, { limit: 200, status: "ACTIVE" });
  const onHand = await onHandByProduct(ctx);
  const lowest = items
    .map((p) => ({ sku: p.product.sku, name: p.product.name, qty: onHand.get(p.product.id) ?? 0 }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 5);
  const lowContent =
    `# Low-stock report - ${today}\n\nThe five lowest-stocked active products.\n\n` +
    `| SKU | Product | On hand |\n|---|---|---|\n` +
    lowest.map((r) => `| ${r.sku} | ${r.name} | ${r.qty} |`).join("\n");
  const lowArt = await createArtifact(ctx, {
    title: `Low-stock report - ${today}`,
    content: lowContent,
    kind: "report",
    format: "markdown",
  });

  const wf = (await listWorkflows(ctx)).find((w) => w.name === "Low-stock report");
  if (wf) {
    const finishedAt = new Date();
    const startedAt = new Date(finishedAt.getTime() - 4200);
    const summary = `Found the 5 lowest-stocked products and saved the report. Lowest: ${lowest[0]?.name ?? "n/a"} (${lowest[0]?.qty ?? 0}).`;
    const [run] = await db
      .insert(workflowRuns)
      .values({
        organizationId: ctx.orgId,
        workflowId: wf.id,
        status: "success",
        summary,
        trigger: "schedule",
        nodeRuns: [
          {
            nodeId: "agent",
            type: "agent",
            name: "Low-stock agent",
            status: "success",
            summary,
            conversationId: null,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
          },
        ],
        createdAt: startedAt,
        finishedAt,
      })
      .returning();
    await db
      .update(artifacts)
      .set({ workflowRunId: run.id, workflowId: wf.id })
      .where(eq(artifacts.id, lowArt.id));
    await db
      .update(workflows)
      .set({ lastRunAt: finishedAt, lastRunStatus: "success" })
      .where(eq(workflows.id, wf.id));
    await createNotification(ctx, {
      userId: null,
      kind: "workflow.success",
      title: "Low-stock report finished",
      body: summary,
      href: `/automations?wf=${wf.id}&run=${run.id}`,
    });
  }
}

/**
 * Seed the transactional-inventory showcase: a second location, Metrc-tagged
 * packages with barcodes/serials + passing COAs, a completed manufacturing run
 * (flower -> pre-rolls, rolling real COGS), a stock transfer, and company
 * licenses (one expiring soon). Idempotent - skips if packages already exist.
 */
async function seedOperationsShowcase(ctx: ReturnType<typeof systemCtx>) {
  if ((await listPackages(ctx, { limit: 1 })).items.length > 0) return;

  const main = await getDefaultLocation(ctx);
  const vault = await findOrCreateLocation(ctx, "Vault (Back Room)");

  // Metrc-tagged packages with barcodes/serials + a passing COA per flower SKU.
  for (const sku of ["FL-BD-35", "FL-OG-35", "FL-GDP-35"]) {
    const p = await getProductBySku(ctx, sku);
    if (!p) continue;
    const seed = Math.abs(hashString(sku));
    const tag = ("1A4FF" + String(seed).padStart(19, "0")).slice(0, 24);
    const { row: pkg } = await upsertPackage(ctx, {
      packageTag: tag,
      productId: p.product.id,
      locationId: main.id,
      quantity: 20,
      status: "ACTIVE",
      metrcTag: tag,
      barcode: `PKG-${sku}`,
      serialNumber: `SN-${seed % 100000}`,
      labTestingState: "TestPassed",
    });
    await upsertTestResult(ctx, {
      productId: p.product.id,
      packageId: pkg.id,
      passed: "PASS",
      metrcLabTestId: `LT-${seed % 100000}`,
      testedAt: new Date(Date.now() - 7 * 864e5),
      results: { thc: "22.4%", cbd: "0.1%", pesticides: "PASS", microbials: "PASS" },
    });
  }

  // A completed manufacturing run: 30g Blue Dream -> 20 pre-rolls, plus labor.
  const flower = await getProductBySku(ctx, "FL-BD-35");
  const preroll = await getProductBySku(ctx, "PR-SD-1");
  if (flower && preroll && (await listAssemblies(ctx, { limit: 1 })).items.length === 0) {
    const { row: asm } = await upsertAssembly(ctx, {
      status: "PENDING",
      locationId: main.id,
      notes: "Roll Blue Dream into pre-rolls",
      inputs: [{ productId: flower.product.id, quantity: 30 }],
      outputs: [{ productId: preroll.product.id, quantity: 20 }],
    });
    const { row: ct } = await upsertCostType(ctx, { name: "Labor" });
    await upsertCost(ctx, {
      assemblyId: asm.id,
      costTypeId: ct.id,
      amount: 40,
      description: "Rolling labor",
    });
    await upsertAssembly(ctx, { id: asm.id, status: "COMPLETED" }); // posts inventory
  }

  // A stock transfer: move vape carts from Main to the Vault.
  const cart = await getProductBySku(ctx, "VP-LR-1");
  if (cart && (await listTransfers(ctx, { limit: 1 })).items.length === 0) {
    try {
      await createTransfer(ctx, {
        fromLocationId: main.id,
        toLocationId: vault.id,
        notes: "Stock the vault",
        lines: [{ productId: cart.product.id, quantity: 15 }],
      });
    } catch {
      /* skip if short */
    }
  }

  // Licenses: our own operating license + two customer licenses (one expiring soon).
  if ((await listLicenses(ctx, { limit: 1 })).items.length === 0) {
    const soon = new Date(Date.now() + 18 * 864e5);
    const later = new Date(Date.now() + 300 * 864e5);
    await upsertLicense(ctx, {
      licenseNumber: "C11-0000123-LIC",
      name: "Green Leaf Collective",
      state: "CA",
      companyId: null,
      expiresAt: later,
    });
    const greenLeaf = await findOrCreateCustomer(ctx, "Green Leaf Dispensary");
    const highDesert = await findOrCreateCustomer(ctx, "High Desert Collective");
    await upsertLicense(ctx, {
      licenseNumber: "C10-0000456-LIC",
      name: "Green Leaf Dispensary",
      state: "CA",
      companyId: greenLeaf.id,
      expiresAt: later,
    });
    await upsertLicense(ctx, {
      licenseNumber: "C10-0000789-LIC",
      name: "High Desert Collective",
      state: "CA",
      companyId: highDesert.id,
      expiresAt: soon,
    });
  }
}

/** Seed a few strains, plant batches, plants, and a harvest for the grow side. */
async function seedCultivation(ctx: ReturnType<typeof systemCtx>) {
  const location = await getDefaultLocation(ctx);
  const strainNames = ["Blue Dream", "OG Kush", "Gelato", "Sour Diesel"];
  const strainId = new Map<string, string>();
  for (const s of (await listStrains(ctx, { limit: 200 })).items) strainId.set(s.name, s.id);
  for (const name of strainNames) {
    if (!strainId.has(name)) {
      const { row } = await upsertStrain(ctx, { name });
      strainId.set(name, row.id);
    }
  }
  const veg = await upsertPlantBatch(ctx, {
    strainId: strainId.get("Blue Dream"),
    locationId: location.id,
    count: 50,
    phase: "VEGETATIVE",
    sourceType: "Clone",
  });
  const flower = await upsertPlantBatch(ctx, {
    strainId: strainId.get("OG Kush"),
    locationId: location.id,
    count: 32,
    phase: "FLOWERING",
    sourceType: "Clone",
  });
  await upsertPlantBatch(ctx, {
    strainId: strainId.get("Gelato"),
    locationId: location.id,
    count: 24,
    phase: "IMMATURE",
    sourceType: "Seed",
  });
  for (let i = 0; i < 4; i++)
    await upsertPlant(ctx, { strainId: strainId.get("Blue Dream"), locationId: location.id, plantBatchId: veg.row.id, phase: "FLOWERING" });
  for (let i = 0; i < 3; i++)
    await upsertPlant(ctx, { strainId: strainId.get("OG Kush"), locationId: location.id, plantBatchId: flower.row.id, phase: "FLOWERING" });
  await upsertHarvest(ctx, {
    name: "Fall Harvest A",
    strainId: strainId.get("OG Kush"),
    locationId: location.id,
    plantCount: 32,
    wetWeight: 8400,
    dryWeight: 1680,
    status: "ACTIVE",
  });
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

/**
 * Seed a driver, a vehicle, a day's route, and a handful of deliveries spread
 * across the dispatch lifecycle - tied to seeded orders - so the Deliveries board
 * and the per-driver manifest are populated on a fresh org. Idempotent: the
 * caller guards on there being no deliveries yet.
 */
/**
 * The workspace's people. Each is a real better-auth login (so a driver can sign
 * into the driver mobile app) with additive roles - note Alicia is both an admin
 * and a driver, demonstrating that roles stack. Drivers get a linked profile
 * (license/phone) that dispatch assigns. Idempotent: reuses an existing login by
 * email and merges roles/profile in place.
 */
const DEMO_TEAM_PASSWORD = "distru1234";
const DEMO_TEAM: {
  name: string;
  email: string;
  roles: string[];
  driver?: { phone: string; licenseNumber: string };
}[] = [
  { name: "Alicia Nguyen", email: "alicia.nguyen@greenleaf.test", roles: ["admin"], driver: { phone: "(512) 555-0148", licenseNumber: "TX-8841203" } },
  { name: "Marcus Reyes", email: "marcus.reyes@greenleaf.test", roles: ["member"], driver: { phone: "(512) 555-0180", licenseNumber: "TX-4471902" } },
  { name: "Jordan Blake", email: "jordan.blake@greenleaf.test", roles: ["admin", "dispatcher"] },
  { name: "Priya Shah", email: "priya.shah@greenleaf.test", roles: ["sales"] },
  { name: "Devon Carter", email: "devon.carter@greenleaf.test", roles: ["fulfillment"] },
];

async function seedTeam(ctx: ReturnType<typeof systemCtx>) {
  for (const p of DEMO_TEAM) {
    const email = p.email.toLowerCase();
    let [u] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (!u) {
      await auth.api.signUpEmail({
        body: { email, password: DEMO_TEAM_PASSWORD, name: p.name },
      });
      [u] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    }
    if (!u) continue;
    await upsertMembership(ctx, { userId: u.id, roles: p.roles });
    if (p.driver) {
      await ensureDriverProfile(ctx, {
        userId: u.id,
        name: p.name,
        phone: p.driver.phone,
        licenseNumber: p.driver.licenseNumber,
      });
    }
  }
}

async function seedDeliveries(ctx: ReturnType<typeof systemCtx>) {
  // A driver + vehicle to dispatch with (reuse any that already exist).
  const existingDrivers = (await listDrivers(ctx, { limit: 1 })).items;
  const driver =
    existingDrivers[0] ??
    (await upsertDriver(ctx, {
      name: "Marcus Reyes",
      phone: "(555) 204-1180",
      licenseNumber: "D-4471902",
    })).row;
  const vehicle = (
    await upsertVehicle(ctx, {
      name: "Sprinter Van 1",
      make: "Mercedes-Benz",
      model: "Sprinter 2500",
      licensePlate: "GRN-4420",
    })
  ).row;

  // Deliveries are scheduled for today so the manifest lights up out of the box.
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const at = (hour: number) => {
    const d = new Date(today);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const routeDate = today.toISOString().slice(0, 10);
  const route = (
    await upsertRoute(ctx, {
      name: `${routeDate} - Metro Run`,
      driverId: driver.id,
      vehicleId: vehicle.id,
      routeDate,
      notes: "North metro dispensary run.",
    })
  ).row;

  // Attach a delivery to each available order, cycling through the lifecycle so
  // every board column has something in it.
  const orders = (await listOrders(ctx, { limit: 10 })).items;
  if (orders.length === 0) return;

  const plan: { status: "DRAFT" | "ASSIGNED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "FAILED" }[] = [
    { status: "ASSIGNED" },
    { status: "OUT_FOR_DELIVERY" },
    { status: "DELIVERED" },
    { status: "DRAFT" },
    { status: "FAILED" },
  ];

  for (let i = 0; i < orders.length && i < plan.length; i++) {
    const order = orders[i].order;
    const step = plan[i];
    const assigned = step.status !== "DRAFT";
    const { row } = await createDeliveryFromOrder(ctx, {
      orderId: order.id,
      driverId: assigned ? driver.id : null,
      vehicleId: assigned ? vehicle.id : null,
      routeId: route.id,
      sequence: i + 1,
      scheduledAt: at(9 + i),
      notes: i === 0 ? "Call on arrival - loading dock in the rear." : null,
    });
    // createDeliveryFromOrder lands ASSIGNED (with a driver) or DRAFT; advance the
    // rest so the board shows the full lifecycle.
    if (step.status === "OUT_FOR_DELIVERY" || step.status === "DELIVERED" || step.status === "FAILED") {
      await advanceDeliveryStatus(ctx, row.id, step.status);
    }
  }
}

/**
 * Seed a couple of CRM sales notes on seeded customers so the company detail
 * timeline is populated out of the box. Idempotent: skips a company that already
 * has any notes.
 */
async function seedCrm(ctx: ReturnType<typeof systemCtx>) {
  const seeds: { company: string; notes: string[] }[] = [
    {
      company: "Green Leaf Dispensary",
      notes: [
        "Intro call with the buyer — interested in flower and vape lines. Sent the current wholesale price list.",
        "Follow-up: placed their first order. Net-30 terms agreed; watch the outstanding balance.",
      ],
    },
    {
      company: "High Desert Collective",
      notes: [
        "Met at the regional expo. Strong interest in edibles; license expires soon — flagged for renewal follow-up.",
      ],
    },
  ];
  for (const seed of seeds) {
    const company = await findOrCreateCustomer(ctx, seed.company);
    const existing = await listCompanyNotes(ctx, company.id, { limit: 1 });
    if (existing.length) continue;
    for (const body of seed.notes) {
      await addCompanyNote(ctx, { companyId: company.id, body, authorId: null });
    }
  }
}

/**
 * Deepen the grow + compliance surfaces so both feel real out of the box:
 *  - a lifecycle event timeline on the first plant batch,
 *  - a lot-level COA (structured potency) tied to a real package, and
 *  - a license expiring inside the 30-day alert window.
 * Idempotent: each step checks for its own prior output before writing. Runs
 * after seedCultivation + seedOperationsShowcase so batches and packages exist.
 */
async function seedGrowCompliance(ctx: ReturnType<typeof systemCtx>) {
  // 1) A plant-event timeline on the first plant batch.
  const { items: batches } = await listPlantBatches(ctx, { limit: 5 });
  const batch = batches[0];
  if (batch) {
    const { items: events } = await listPlantEvents(ctx, {
      plantBatchId: batch.id,
      limit: 1,
    });
    if (events.length === 0) {
      await logPlantEvent(ctx, {
        plantBatchId: batch.id,
        type: "FEED",
        note: "Fed CalMag + base nutrients at 700 PPM.",
      });
      await logPlantEvent(ctx, {
        plantBatchId: batch.id,
        type: "PHASE_CHANGE",
        note: `IMMATURE → ${batch.phase}`,
        detail: JSON.stringify({ from: "IMMATURE", to: batch.phase }),
      });
    }
  }

  // 2) A lot-level COA with structured potency on a real package.
  const { items: pkgs } = await listPackages(ctx, { limit: 20 });
  const pkg = pkgs.find((p) => p.productId) ?? pkgs[0];
  if (pkg) {
    const existing = await getPackageTestResult(ctx, pkg.id);
    if (!existing) {
      await upsertTestResult(ctx, {
        productId: pkg.productId ?? null,
        packageId: pkg.id,
        passed: "PASS",
        metrcLabTestId: `LT-COA-${pkg.packageTag.slice(-4)}`,
        coaUrl: "https://example-lab.test/coa/sample.pdf",
        thcPercentage: 24.8,
        cbdPercentage: 0.2,
        thcMgPerUnit: 248,
        cbdMgPerUnit: 2,
        testedAt: new Date(Date.now() - 5 * 864e5),
        results: { thc: "24.8%", cbd: "0.2%", terpenes: "3.1%", pesticides: "PASS" },
      });
    }
  }

  // 3) Ensure a license is expiring inside the alert window.
  const soon = await expiringLicenses(ctx, 30);
  if (soon.length === 0) {
    try {
      await upsertLicense(ctx, {
        licenseNumber: "C10-EXPIRING-0001-LIC",
        name: "Sunset Wellness (renewal due)",
        state: "CA",
        expiresAt: new Date(Date.now() + 12 * 864e5),
      });
    } catch {
      /* license already present */
    }
  }
}

/**
 * Seed a real-feeling Austin, TX operating day for the DISPATCH board:
 *  - a central depot and two vans (with depot base coords) + their drivers,
 *  - TODAY's run: a couple of stops already DELIVERED this morning and a couple
 *    OUT_FOR_DELIVERY with each van mid-route toward its current stop, and
 *  - TOMORROW's run: ASSIGNED stops scheduled but not yet started,
 * every stop with a plausible Austin street address + coordinates, and a
 * last-known telemetry ping per van so the map is "live" the instant it loads.
 * Idempotent: skips once any telemetry exists. Uses relative dates (today /
 * tomorrow) so a nightly reseed always produces a fresh day.
 */
async function seedDispatch(ctx: ReturnType<typeof systemCtx>) {
  if ((await getTelemetryByVehicle(ctx)).size > 0) return;

  // Reuse any driver/vehicle a prior seed step already created (both are unique
  // by org+name), otherwise create - so seedDispatch composes with seedDeliveries
  // instead of colliding on a shared name (e.g. "Marcus Reyes").
  const existingVehicles = (await listVehicles(ctx, { limit: 200 })).items;
  const existingDriversList = (await listDrivers(ctx, { limit: 200 })).items;
  const findOrCreateVehicle = async (input: Parameters<typeof upsertVehicle>[1]) => {
    const found = existingVehicles.find((v) => v.name === input.name);
    if (found) return found;
    const { row } = await upsertVehicle(ctx, input);
    existingVehicles.push(row);
    return row;
  };
  const findOrCreateDriver = async (input: Parameters<typeof upsertDriver>[1]) => {
    const found = existingDriversList.find((d) => d.name === input.name);
    if (found) return found;
    const { row } = await upsertDriver(ctx, input);
    existingDriversList.push(row);
    return row;
  };

  // Two vans, homed at the Austin depot.
  const vanA = await findOrCreateVehicle({
    name: "Cargo Van 12",
    make: "Ford",
    model: "Transit 250",
    licensePlate: "ATX-1120",
    lat: AUSTIN_DEPOT.lat,
    lng: AUSTIN_DEPOT.lng,
  });
  const vanB = await findOrCreateVehicle({
    name: "Sprinter 08",
    make: "Mercedes-Benz",
    model: "Sprinter 2500",
    licensePlate: "ATX-0842",
    lat: AUSTIN_DEPOT.lat,
    lng: AUSTIN_DEPOT.lng,
  });

  const driverA = await findOrCreateDriver({
    name: "Alicia Nguyen",
    phone: "(512) 555-0148",
    licenseNumber: "TX-8841203",
  });
  const driverB = await findOrCreateDriver({
    name: "Marcus Reyes",
    phone: "(512) 555-0180",
    licenseNumber: "TX-4471902",
  });

  // Local-day helpers (relative dates so every reseed is a fresh day).
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const dayStr = (dayOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().slice(0, 10);
  };

  const routeToday = (
    await upsertRoute(ctx, {
      name: `${dayStr(0)} - Austin Metro`,
      driverId: driverA.id,
      vehicleId: vanA.id,
      routeDate: dayStr(0),
      notes: "Central + east Austin dispensary run.",
    })
  ).row;
  const routeTomorrow = (
    await upsertRoute(ctx, {
      name: `${dayStr(1)} - Austin Metro`,
      driverId: driverB.id,
      vehicleId: vanB.id,
      routeDate: dayStr(1),
      notes: "North + west Austin dispensary run.",
    })
  ).row;

  type Stop = {
    tag: string;
    customer: string;
    line1: string;
    postal: string;
    lat: number;
    lng: number;
    sku: string;
    qty: number;
    when: Date;
    sequence: number;
    driverId: string;
    vehicleId: string;
    routeId: string;
    target: "DELIVERED" | "OUT_FOR_DELIVERY" | "ASSIGNED";
  };

  const stops: Stop[] = [
    // ---- Van A, today ----
    { tag: "a1", customer: "Congress Ave Cannabis", line1: "1519 S Congress Ave", postal: "78704", lat: 30.25, lng: -97.75, sku: "ED-GUM-100", qty: 6, when: at(0, 9), sequence: 1, driverId: driverA.id, vehicleId: vanA.id, routeId: routeToday.id, target: "DELIVERED" },
    { tag: "a2", customer: "East Side Botanicals", line1: "1000 E 6th St", postal: "78702", lat: 30.266, lng: -97.733, sku: "PR-SD-1", qty: 10, when: at(0, 11), sequence: 2, driverId: driverA.id, vehicleId: vanA.id, routeId: routeToday.id, target: "OUT_FOR_DELIVERY" },
    { tag: "a3", customer: "Mueller Green Room", line1: "1911 Aldrich St", postal: "78723", lat: 30.298, lng: -97.705, sku: "VP-DISP-05", qty: 8, when: at(0, 13), sequence: 3, driverId: driverA.id, vehicleId: vanA.id, routeId: routeToday.id, target: "OUT_FOR_DELIVERY" },
    // ---- Van B, today ----
    { tag: "b1", customer: "Zilker Wellness", line1: "2201 Barton Springs Rd", postal: "78746", lat: 30.264, lng: -97.771, sku: "ED-CHOC-100", qty: 5, when: at(0, 10), sequence: 1, driverId: driverB.id, vehicleId: vanB.id, routeId: routeToday.id, target: "DELIVERED" },
    { tag: "b2", customer: "North Lamar Dispensary", line1: "5601 N Lamar Blvd", postal: "78751", lat: 30.323, lng: -97.725, sku: "FL-BD-35", qty: 4, when: at(0, 12), sequence: 2, driverId: driverB.id, vehicleId: vanB.id, routeId: routeToday.id, target: "OUT_FOR_DELIVERY" },
    // ---- Tomorrow (assigned, not yet started) ----
    { tag: "t1", customer: "Domain Collective", line1: "11410 Century Oaks Ter", postal: "78758", lat: 30.401, lng: -97.725, sku: "VP-LR-1", qty: 6, when: at(1, 10), sequence: 1, driverId: driverA.id, vehicleId: vanA.id, routeId: routeTomorrow.id, target: "ASSIGNED" },
    { tag: "t2", customer: "Westlake Remedies", line1: "3300 Bee Cave Rd", postal: "78746", lat: 30.279, lng: -97.8, sku: "FL-OG-35", qty: 3, when: at(1, 11), sequence: 2, driverId: driverB.id, vehicleId: vanB.id, routeId: routeTomorrow.id, target: "ASSIGNED" },
  ];

  const deliveryIdByTag = new Map<string, string>();
  for (const s of stops) {
    const product = await getProductBySku(ctx, s.sku);
    if (!product) continue;
    const customer = await findOrCreateCustomer(ctx, s.customer);
    const address = { line1: s.line1, city: "Austin", state: "TX", postal_code: s.postal, country: "US" };
    // A backing order so the stop carries a real order number + customer, then a
    // delivery snapshotting that address with its destination coordinates.
    const order = await createOrder(ctx, {
      customerId: customer.id,
      status: "PROCESSING",
      shippingAddress: address,
      items: [
        {
          productId: product.product.id,
          sku: product.product.sku,
          name: product.product.name,
          quantity: s.qty,
          unitPrice: Number(product.product.unitPrice ?? 0),
        },
      ],
    });
    const { row } = await createDeliveryFromOrder(ctx, {
      orderId: order.order.id,
      driverId: s.driverId,
      vehicleId: s.vehicleId,
      routeId: s.routeId,
      sequence: s.sequence,
      scheduledAt: s.when,
      address,
      lat: s.lat,
      lng: s.lng,
    });
    // createDeliveryFromOrder lands ASSIGNED (a driver was given); advance today's.
    if (s.target === "OUT_FOR_DELIVERY") await advanceDeliveryStatus(ctx, row.id, "OUT_FOR_DELIVERY");
    else if (s.target === "DELIVERED") await advanceDeliveryStatus(ctx, row.id, "DELIVERED");
    deliveryIdByTag.set(s.tag, row.id);
  }

  // Rough compass bearing (0=N, 90=E) between two points, for a realistic heading.
  const bearing = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
    const dx = (b.lng - a.lng) * Math.cos(midLat);
    const dy = b.lat - a.lat;
    return Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // Place each van mid-route toward its CURRENT out-for-delivery stop, with the
  // matching heading + a plausible speed, so the map reads as genuinely en route.
  const vanARoute = { lat: 30.266, lng: -97.733 }; // toward East Side Botanicals (a2)
  await upsertTelemetry(ctx, {
    vehicleId: vanA.id,
    lat: lerp(AUSTIN_DEPOT.lat, vanARoute.lat, 0.55),
    lng: lerp(AUSTIN_DEPOT.lng, vanARoute.lng, 0.55),
    speedMph: 21,
    headingDeg: bearing(AUSTIN_DEPOT, vanARoute),
    status: "EN_ROUTE",
    currentDeliveryId: deliveryIdByTag.get("a2") ?? null,
    recordPing: true,
  });

  const vanBRoute = { lat: 30.323, lng: -97.725 }; // toward North Lamar Dispensary (b2)
  await upsertTelemetry(ctx, {
    vehicleId: vanB.id,
    lat: lerp(AUSTIN_DEPOT.lat, vanBRoute.lat, 0.45),
    lng: lerp(AUSTIN_DEPOT.lng, vanBRoute.lng, 0.45),
    speedMph: 27,
    headingDeg: bearing(AUSTIN_DEPOT, vanBRoute),
    status: "EN_ROUTE",
    currentDeliveryId: deliveryIdByTag.get("b2") ?? null,
    recordPing: true,
  });
}
