import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  artifacts,
  deliveries as deliveriesTable,
  deliveryRoutes as deliveryRoutesTable,
  locations as locationsTable,
  unitTypes,
  user,
  workflowRuns,
  workflows,
} from "@/db/schema";
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
import { configureProvider, getConnection, runMockSync } from "@/lib/modules/platform";
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
  AUSTIN_BOUNDS,
  AUSTIN_DEPOT,
  createDeliveryFromOrder,
  listDeliveries,
  listDrivers,
  listVehicles,
  upsertDriver,
  upsertRoute,
  upsertVehicle,
  warmRunGeometry,
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
      "save_report to save it (title 'Low-stock report - <today>'), and email it to " +
      "ops@greenleaf.test with email_report. Read-only; do not change any data. If " +
      "no email integration is connected, save the report and stop.";
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
          {
            id: "tool_email",
            type: "tool",
            name: "email_report",
            params: { tool: "email_report" },
            position: { x: 680, y: 380 },
          },
        ],
        connections: {
          trigger: { main: [[{ node: "agent" }]] },
          tool_inv: { ai_tool: [[{ node: "agent" }]] },
          tool_save: { ai_tool: [[{ node: "agent" }]] },
          tool_email: { ai_tool: [[{ node: "agent" }]] },
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
 * Set up QuickBooks + Metrc with demo credentials (which auto-connects them) and
 * run a mock sync for each, so the Integrations screen shows two *configured,
 * connected* providers with last-synced times and a populated sync-activity
 * feed - while the rest sit at "Setup required" to demonstrate the setup gate.
 * The credentials are obviously fake; they exist so the demo shows the connected
 * state a real tenant would reach after entering their own. Idempotent: skips
 * once a connection exists.
 */
async function seedIntegrations(ctx: ReturnType<typeof systemCtx>) {
  if (await getConnection(ctx, "quickbooks")) return;
  // `__demo` keeps these on the believable mock sync path (the creds are fake).
  // A real tenant entering real credentials in the UI omits it -> live adapter.
  await configureProvider(ctx, "quickbooks", {
    __demo: true,
    environment: "production",
    realmId: "4620816365200000000",
    clientId: "ABxDemoClientId0000000000000000",
    clientSecret: "demo-secret-not-a-real-key",
  });
  await configureProvider(ctx, "metrc", {
    __demo: true,
    state: "ca",
    vendorKey: "demo-vendor-key-0000",
    userKey: "demo-user-key-0000",
  });
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

  // Scheduled for TOMORROW: today's live dispatch is owned by seedDispatch's
  // real-time runs, so this Deliveries-tab demo sits a day out to avoid colliding
  // with a driver's scheduled run (which would merge into one route).
  const today = new Date();
  today.setDate(today.getDate() + 1);
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
 * Seed a real-time Austin, TX operating day for the DISPATCH board: a small,
 * legible fleet of 10 drivers + vans, each on a clustered multi-stop run with a
 * real schedule (a morning departure and an afternoon completion). Nothing is
 * pre-marked delivered and no positions are stored - the dispatch map derives
 * every vehicle's live position, status, ETA, and drop times from the current
 * wall-clock time against each run's window, so the day plays out on its own in
 * real time (early morning: still loading; midday: mid-route; evening: all done).
 * Also seeds the configurable depot as a real `locations` row. Street geometry is
 * warmed into the cache so the first load is instant. Deterministic + idempotent.
 */
async function seedDispatch(ctx: ReturnType<typeof systemCtx>) {
  // Idempotent: skip once the day's scheduled runs exist.
  const already = await db
    .select({ id: deliveryRoutesTable.id })
    .from(deliveryRoutesTable)
    .where(and(eq(deliveryRoutesTable.organizationId, ctx.orgId), isNotNull(deliveryRoutesTable.departureAt)))
    .limit(1);
  if (already.length > 0) return;

  // Deterministic RNG so every reseed produces the same believable day.
  let seed = 0x1a2b3c4d;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  const range = (min: number, max: number) => min + rnd() * (max - min);
  const int = (min: number, max: number) => Math.floor(range(min, max + 1));

  // Local-day helper (relative dates so every reseed is a fresh day).
  const at = (hour: number, minute = 0) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const dayStr = () => new Date().toISOString().slice(0, 10);

  // Seed the depot as a real, editable location (this is where it's configured).
  await db
    .insert(locationsTable)
    .values({
      organizationId: ctx.orgId,
      name: "Austin Depot",
      address: "Downtown Austin, TX 78701",
      lat: AUSTIN_DEPOT.lat.toFixed(6),
      lng: AUSTIN_DEPOT.lng.toFixed(6),
      isDepot: true,
    })
    .onConflictDoNothing();

  // ---- Name + place pools --------------------------------------------------
  const FIRST = [
    "Alicia", "Marcus", "Priya", "Diego", "Hannah", "Tyrell", "Sofia", "Liam", "Noor", "Grace",
    "Elena", "Jamal", "Wei", "Carlos", "Aisha", "Owen", "Maya", "Ravi", "Nadia", "Cole",
  ] as const;
  const LAST = [
    "Nguyen", "Reyes", "Patel", "Okafor", "Kim", "Alvarez", "Brooks", "Santos", "Duval", "Ford",
    "Cho", "Mercado", "Ellis", "Haddad", "Novak", "Bauer", "Ramos", "Whitfield", "Osei", "Lang",
  ] as const;
  const MAKES: readonly [string, string][] = [
    ["Ford", "Transit 250"],
    ["Mercedes-Benz", "Sprinter 2500"],
    ["Ram", "ProMaster 1500"],
    ["Ford", "Transit 350"],
    ["Chevrolet", "Express 2500"],
    ["Rivian", "EDV 700"],
  ];
  const BIZ_A = [
    "Congress", "East Side", "Zilker", "Mueller", "North Lamar", "Domain", "Westlake", "Barton",
    "Rainey", "Clarksville", "Hyde Park", "Bouldin", "Travis Heights", "Cherrywood", "Allandale",
    "Crestview", "Windsor", "Manor", "Riverside", "Oltorf",
  ] as const;
  const BIZ_B = [
    "Cannabis Co.", "Botanicals", "Wellness", "Green Room", "Dispensary", "Collective", "Remedies",
    "Provisions", "Apothecary", "Gardens", "Reserve", "Supply", "Leaf & Co.", "Holistics",
  ] as const;
  const STREETS = [
    "Congress Ave", "S Lamar Blvd", "N Lamar Blvd", "Guadalupe St", "E 6th St", "W 5th St",
    "Barton Springs Rd", "S 1st St", "Manor Rd", "Airport Blvd", "Cesar Chavez St", "Burnet Rd",
    "Anderson Ln", "Riverside Dr", "William Cannon Dr", "Slaughter Ln", "Parmer Ln", "Bee Cave Rd",
  ] as const;
  const CLUSTERS: readonly { lat: number; lng: number; postal: string }[] = [
    { lat: 30.250, lng: -97.750, postal: "78704" },
    { lat: 30.267, lng: -97.734, postal: "78702" },
    { lat: 30.264, lng: -97.771, postal: "78746" },
    { lat: 30.298, lng: -97.705, postal: "78723" },
    { lat: 30.323, lng: -97.725, postal: "78751" },
    { lat: 30.401, lng: -97.725, postal: "78758" },
    { lat: 30.228, lng: -97.790, postal: "78745" },
    { lat: 30.285, lng: -97.807, postal: "78746" },
    { lat: 30.352, lng: -97.680, postal: "78724" },
    { lat: 30.240, lng: -97.700, postal: "78741" },
  ];

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // ---- Fleet: 10 drivers + vans (reuse any existing, top up to 10) ---------
  const FLEET_SIZE = 10;
  const existingVehicles = (await listVehicles(ctx, { limit: 200 })).items;
  const existingDrivers = (await listDrivers(ctx, { limit: 200 })).items;
  const usedVehicleNames = new Set(existingVehicles.map((v) => v.name));
  const usedDriverNames = new Set(existingDrivers.map((d) => d.name));
  const vans = [...existingVehicles];
  const drvs = [...existingDrivers];

  let vseq = 1;
  while (vans.length < FLEET_SIZE) {
    let name = `Van ${String(vseq).padStart(2, "0")}`;
    while (usedVehicleNames.has(name)) name = `Van ${String(++vseq).padStart(2, "0")}`;
    usedVehicleNames.add(name);
    const [make, model] = MAKES[vseq % MAKES.length];
    const { row } = await upsertVehicle(ctx, { name, make, model, licensePlate: `ATX-${1000 + vans.length}`, lat: AUSTIN_DEPOT.lat, lng: AUSTIN_DEPOT.lng });
    vans.push(row);
    vseq++;
  }
  while (drvs.length < FLEET_SIZE) {
    let name = `${pick(FIRST)} ${pick(LAST)}`;
    let tries = 0;
    while (usedDriverNames.has(name) && tries++ < 60) name = `${pick(FIRST)} ${pick(LAST)}`;
    if (usedDriverNames.has(name)) name = `${name} ${drvs.length}`;
    usedDriverNames.add(name);
    const { row } = await upsertDriver(ctx, { name, phone: `(512) 555-${String(2000 + drvs.length).slice(-4)}`, licenseNumber: `TX-${3000000 + drvs.length * 137}` });
    drvs.push(row);
  }

  // ---- Generate each driver's scheduled run --------------------------------
  const warmJobs: { stops: { id: string; lat: number; lng: number }[] }[] = [];

  for (let i = 0; i < FLEET_SIZE; i++) {
    const van = vans[i];
    const drv = drvs[i];
    const cluster = CLUSTERS[i % CLUSTERS.length];
    // A real route is dense: ~12-18 drops. With a realistic ~30 min per drop
    // (drive + drop-off), a run spans most of the working day, so trucks move at
    // a believable crawl and the day genuinely progresses stop by stop.
    const stopCount = int(12, 18);
    const slotMin = int(26, 34); // minutes per stop (drive + drop-off)

    // Staggered morning departures; completion falls out of the stop count so the
    // pacing stays realistic (departure + one slot per stop + a return leg).
    const departure = at(7, 30 + i * 16); // 7:30 ... ~10:00
    const complete = new Date(departure.getTime() + (stopCount + 1) * slotMin * 60_000);

    const raw = Array.from({ length: stopCount }, () => ({
      lat: clamp(cluster.lat + range(-0.028, 0.028), AUSTIN_BOUNDS.south, AUSTIN_BOUNDS.north),
      lng: clamp(cluster.lng + range(-0.032, 0.032), AUSTIN_BOUNDS.west, AUSTIN_BOUNDS.east),
    }));
    raw.sort((a, b) => {
      const da = (a.lat - AUSTIN_DEPOT.lat) ** 2 + (a.lng - AUSTIN_DEPOT.lng) ** 2;
      const db2 = (b.lat - AUSTIN_DEPOT.lat) ** 2 + (b.lng - AUSTIN_DEPOT.lng) ** 2;
      return da - db2;
    });

    // Even drop times across the run window, so scheduledAt reads like a plan.
    const span = complete.getTime() - departure.getTime();
    const slot = span / (stopCount + 1);

    const route = (
      await upsertRoute(ctx, {
        name: `${dayStr()} - ${drv.name.split(" ")[0]}'s run`,
        driverId: drv.id,
        vehicleId: van.id,
        routeDate: dayStr(),
        notes: `${stopCount} stops - ${cluster.postal} area.`,
      })
    ).row;
    // Stamp the schedule window on the route (the real-time sim reads this).
    await db
      .update(deliveryRoutesTable)
      .set({ departureAt: departure, completeAt: complete })
      .where(eq(deliveryRoutesTable.id, route.id));

    const values = raw.map((p, idx) => {
      const name = `${pick(BIZ_A)} ${pick(BIZ_B)}`;
      return {
        organizationId: ctx.orgId,
        orderId: null,
        routeId: route.id,
        driverId: drv.id,
        vehicleId: van.id,
        status: "ASSIGNED" as const,
        address: {
          name,
          line1: `${int(100, 9899)} ${pick(STREETS)}`,
          city: "Austin",
          state: "TX",
          postal_code: cluster.postal,
          country: "US",
        },
        lat: p.lat.toFixed(6),
        lng: p.lng.toFixed(6),
        sequence: idx + 1,
        scheduledAt: new Date(departure.getTime() + (idx + 1) * slot),
        deliveredAt: null,
      };
    });

    const inserted = await db
      .insert(deliveriesTable)
      .values(values)
      .returning({ id: deliveriesTable.id, lat: deliveriesTable.lat, lng: deliveriesTable.lng, sequence: deliveriesTable.sequence });

    warmJobs.push({
      stops: inserted
        .slice()
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((d) => ({ id: d.id, lat: Number(d.lat), lng: Number(d.lng) })),
    });
  }

  // Warm real street geometry for every run into the persistent cache.
  const CONCURRENCY = 5;
  for (let i = 0; i < warmJobs.length; i += CONCURRENCY) {
    await Promise.all(warmJobs.slice(i, i + CONCURRENCY).map((j) => warmRunGeometry(ctx, AUSTIN_DEPOT, j.stops)));
  }
}
