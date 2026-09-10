import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import { findOrCreateLocation, getDefaultLocation } from "@/lib/modules/catalog";
import { listPackages } from "@/lib/modules/inventory";
import {
  advancePlantBatchPhase,
  getPlantBatch,
  listPlantBatches,
  getHarvest,
  listHarvests,
  packageHarvest,
  type PlantPhase,
} from "@/lib/modules/cultivation";
import {
  expiringLicenses,
  upsertTestResult,
} from "@/lib/modules/compliance";
import { resolveProduct } from "./_helpers";

const PHASES = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED", "DESTROYED"] as const;

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

/** Resolve a plant batch by its number (e.g. PB-0001) or id within the org. */
async function findBatch(ctx: AgentContext, ref: string) {
  const { items } = await listPlantBatches(ctx.service, { limit: 200 });
  const byNumber = items.find(
    (b) => b.batchNumber.toLowerCase() === ref.trim().toLowerCase(),
  );
  return byNumber ?? (await getPlantBatch(ctx.service, ref));
}

/** Resolve a harvest by its number (e.g. H-0001) or id within the org. */
async function findHarvest(ctx: AgentContext, ref: string) {
  const { items } = await listHarvests(ctx.service, { limit: 200 });
  const byNumber = items.find(
    (h) => h.harvestNumber.toLowerCase() === ref.trim().toLowerCase(),
  );
  return byNumber ?? (await getHarvest(ctx.service, ref));
}

export const advancePlantBatchTool = defineTool({
  name: "advance_plant_batch",
  description:
    "Advance a plant batch to the next lifecycle phase (IMMATURE -> VEGETATIVE -> " +
    "FLOWERING -> HARVESTED), or to an explicit `to` phase. Identify the batch by " +
    "its number (e.g. PB-0001) or id. Logs a PHASE_CHANGE event on the batch timeline.",
  gate: "confirmation",
  inputSchema: z.object({
    batch: z.string().describe("Plant batch number (e.g. PB-0001) or id"),
    to: z.enum(PHASES).optional().describe("Target phase; omit to advance one step"),
  }),
  async buildPreview(input, ctx) {
    const batch = await findBatch(ctx, input.batch);
    return confirm(
      "Advance plant batch",
      batch
        ? `Advance batch ${batch.batchNumber} from ${batch.phase}${input.to ? ` to ${input.to}` : " to the next phase"}.`
        : `Batch ${input.batch} not found.`,
      [
        { label: "Batch", value: batch?.batchNumber ?? input.batch },
        { label: "Current phase", value: batch?.phase ?? "-" },
        { label: "Target", value: input.to ?? "next phase" },
      ],
      input.to === "DESTROYED" ? "high" : "low",
    );
  },
  async execute(input, ctx) {
    const batch = await findBatch(ctx, input.batch);
    if (!batch) return { ok: false, summary: `No plant batch found for "${input.batch}".` };
    try {
      const row = await advancePlantBatchPhase(
        ctx.service,
        batch.id,
        input.to as PlantPhase | undefined,
      );
      return {
        ok: true,
        summary: `Batch ${row.batchNumber} advanced to ${row.phase}.`,
        data: { batch_number: row.batchNumber, phase: row.phase },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Advance failed." };
    }
  },
});

export const packageHarvestTool = defineTool({
  name: "package_harvest",
  description:
    "Close the seed-to-sale loop: package a harvest's dry weight into real, costed " +
    "inventory. Matches the target product by SKU or name and the location by name " +
    "(defaults to the primary location). Quantity defaults to the harvest's recorded " +
    "dry weight. Creates a package + a FIFO stock lot and marks the harvest FINISHED.",
  gate: "confirmation",
  inputSchema: z.object({
    harvest: z.string().describe("Harvest number (e.g. H-0001) or id"),
    product: z.string().describe("SKU or product name the packaged flower becomes"),
    location: z.string().optional().describe("Location/room name; created if new"),
    quantity: z.number().positive().optional().describe("Grams to package; defaults to dry weight"),
  }),
  async buildPreview(input, ctx) {
    const harvest = await findHarvest(ctx, input.harvest);
    const p = await resolveProduct(ctx.service, { sku: input.product, name: input.product });
    const qty =
      input.quantity ?? (harvest?.dryWeight != null ? Number(harvest.dryWeight) : null);
    return confirm(
      "Package harvest",
      harvest
        ? `Package ${qty ?? "?"} g from harvest ${harvest.harvestNumber} into ${p?.product.name ?? input.product}.`
        : `Harvest ${input.harvest} not found.`,
      [
        { label: "Harvest", value: harvest?.harvestNumber ?? input.harvest },
        { label: "Product", value: p ? `${p.product.name} (${p.product.sku})` : input.product },
        { label: "Quantity", value: qty != null ? `${qty} g` : "-" },
        { label: "Location", value: input.location ?? "primary" },
      ],
      "medium",
    );
  },
  async execute(input, ctx) {
    const harvest = await findHarvest(ctx, input.harvest);
    if (!harvest) return { ok: false, summary: `No harvest found for "${input.harvest}".` };
    const p = await resolveProduct(ctx.service, { sku: input.product, name: input.product });
    if (!p) return { ok: false, summary: `No product matched "${input.product}".` };
    const location = input.location
      ? await findOrCreateLocation(ctx.service, input.location)
      : await getDefaultLocation(ctx.service);
    try {
      const res = await packageHarvest(ctx.service, {
        harvestId: harvest.id,
        productId: p.product.id,
        locationId: location.id,
        quantity: input.quantity,
      });
      return {
        ok: true,
        summary: `Packaged ${res.quantity} g from ${harvest.harvestNumber} as ${res.package.packageTag} (lot ${res.lotNumber}); on-hand ${res.onHand}.`,
        data: {
          harvest_number: harvest.harvestNumber,
          package_tag: res.package.packageTag,
          lot_number: res.lotNumber,
          quantity: res.quantity,
          on_hand: res.onHand,
          product: p.product.name,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Packaging failed." };
    }
  },
});

export const recordCoaTool = defineTool({
  name: "record_coa",
  description:
    "Record a certificate of analysis (lab test result) for a product, with " +
    "structured potency (THC/CBD percentage and mg per unit) and a pass/fail. " +
    "Optionally attach it to a specific package by its tag for lot-level traceability.",
  gate: "confirmation",
  inputSchema: z.object({
    product: z.string().describe("SKU or product name the COA is for"),
    passed: z.string().optional().describe("PASS, FAIL, or PENDING"),
    thc_percentage: z.number().optional().describe("THC potency, percent"),
    cbd_percentage: z.number().optional().describe("CBD potency, percent"),
    thc_mg_per_unit: z.number().optional().describe("THC mg per unit"),
    cbd_mg_per_unit: z.number().optional().describe("CBD mg per unit"),
    package_tag: z.string().optional().describe("Package tag to link the COA to"),
    coa_url: z.string().optional().describe("Link to the COA document"),
    tested_at: z.string().optional().describe("ISO date the sample was tested"),
  }),
  async buildPreview(input, ctx) {
    const p = await resolveProduct(ctx.service, { sku: input.product, name: input.product });
    return confirm(
      "Record COA",
      `Record a ${input.passed ?? "lab"} result for ${p?.product.name ?? input.product}.`,
      [
        { label: "Product", value: p ? `${p.product.name} (${p.product.sku})` : input.product },
        { label: "Result", value: input.passed ?? "-" },
        { label: "THC", value: input.thc_percentage != null ? `${input.thc_percentage}%` : "-" },
        { label: "CBD", value: input.cbd_percentage != null ? `${input.cbd_percentage}%` : "-" },
        { label: "Package", value: input.package_tag ?? "-" },
      ],
      "low",
    );
  },
  async execute(input, ctx) {
    const p = await resolveProduct(ctx.service, { sku: input.product, name: input.product });
    if (!p) return { ok: false, summary: `No product matched "${input.product}".` };
    let packageId: string | null = null;
    if (input.package_tag) {
      const { items } = await listPackages(ctx.service, { limit: 200 });
      const pkg = items.find(
        (x) => x.packageTag.toLowerCase() === input.package_tag!.trim().toLowerCase(),
      );
      if (!pkg) return { ok: false, summary: `No package found with tag "${input.package_tag}".` };
      packageId = pkg.id;
    }
    try {
      const { row } = await upsertTestResult(ctx.service, {
        productId: p.product.id,
        packageId,
        passed: input.passed ?? null,
        thcPercentage: input.thc_percentage ?? null,
        cbdPercentage: input.cbd_percentage ?? null,
        thcMgPerUnit: input.thc_mg_per_unit ?? null,
        cbdMgPerUnit: input.cbd_mg_per_unit ?? null,
        coaUrl: input.coa_url ?? null,
        testedAt: input.tested_at ? new Date(input.tested_at) : null,
      });
      return {
        ok: true,
        summary: `Recorded COA for ${p.product.name}${row.passed ? ` (${row.passed})` : ""}.`,
        data: {
          product: p.product.name,
          passed: row.passed ?? null,
          thc_percentage: row.thcPercentage,
          cbd_percentage: row.cbdPercentage,
          package_id: packageId,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "COA record failed." };
    }
  },
});

export const listExpiringLicensesTool = defineTool({
  name: "list_expiring_licenses",
  description:
    "List compliance licenses expiring within a window (default 30 days), soonest " +
    "first. Use to surface renewal risk before selling to a customer whose license lapses.",
  gate: "none",
  inputSchema: z.object({
    days: z.number().int().min(1).max(365).optional().describe("Look-ahead window in days (default 30)"),
  }),
  async execute(input, ctx) {
    const days = input.days ?? 30;
    const rows = await expiringLicenses(ctx.service, days);
    return {
      ok: true,
      summary: `${rows.length} license(s) expiring within ${days} day(s).`,
      data: {
        days,
        licenses: rows.map((l) => ({
          license_number: l.licenseNumber,
          name: l.name ?? null,
          state: l.state ?? null,
          expires_at: l.expiresAt ? l.expiresAt.toISOString() : null,
        })),
      },
    };
  },
});

export const growTools = [
  advancePlantBatchTool,
  packageHarvestTool,
  recordCoaTool,
  listExpiringLicensesTool,
];
