import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  findOrCreateLocation,
  listStrains,
  upsertStrain,
} from "@/lib/modules/catalog";
import {
  listHarvests,
  listPlantBatches,
  listPlants,
  getPlant,
  movePlantPhase,
  upsertHarvest,
  upsertPlantBatch,
  type PlantPhase,
} from "@/lib/modules/cultivation";

const PHASES = ["IMMATURE", "VEGETATIVE", "FLOWERING", "HARVESTED", "DESTROYED"] as const;

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

/** Resolve a strain name to its id, creating the strain when it does not exist. */
async function resolveStrainId(
  ctx: AgentContext,
  name?: string,
): Promise<{ id: string; name: string } | null> {
  if (!name) return null;
  const { items } = await listStrains(ctx.service, { limit: 200 });
  const found = items.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  if (found) return { id: found.id, name: found.name };
  const { row } = await upsertStrain(ctx.service, { name });
  return { id: row.id, name: row.name };
}

/** Resolve an optional location name to its id (creating it if new). */
async function resolveLocationId(ctx: AgentContext, name?: string) {
  if (!name) return null;
  const loc = await findOrCreateLocation(ctx.service, name);
  return { id: loc.id, name: loc.name };
}

export const createPlantBatchTool = defineTool({
  name: "create_plant_batch",
  description:
    "Create a plant batch for a strain (matched by name, created if new) with a " +
    "starting plant count, optional location, and source type (e.g. SEED, CLONE). " +
    "Defaults to the IMMATURE phase.",
  gate: "confirmation",
  inputSchema: z.object({
    strain: z.string().describe("Strain name; created if it does not exist"),
    count: z.number().int().min(0).describe("Number of plants in the batch"),
    location: z.string().optional().describe("Location/room name; created if new"),
    source_type: z.string().optional().describe("Origin of the plants, e.g. SEED or CLONE"),
    phase: z.enum(PHASES).optional().describe("Lifecycle phase; defaults to IMMATURE"),
  }),
  async buildPreview(input, ctx) {
    const strain = await resolveStrainId(ctx, input.strain);
    const location = await resolveLocationId(ctx, input.location);
    return confirm(
      "Create plant batch",
      `Start a batch of ${input.count} ${input.strain} plant(s).`,
      [
        { label: "Strain", value: strain?.name ?? input.strain },
        { label: "Count", value: String(input.count) },
        { label: "Location", value: location?.name ?? "-" },
        { label: "Source", value: input.source_type ?? "-" },
        { label: "Phase", value: input.phase ?? "IMMATURE" },
      ],
      "low",
    );
  },
  async execute(input, ctx) {
    const strain = await resolveStrainId(ctx, input.strain);
    const location = await resolveLocationId(ctx, input.location);
    const { row } = await upsertPlantBatch(ctx.service, {
      strainId: strain?.id ?? null,
      locationId: location?.id ?? null,
      count: input.count,
      sourceType: input.source_type ?? null,
      phase: input.phase as PlantPhase | undefined,
    });
    return {
      ok: true,
      summary: `Created plant batch ${row.batchNumber} - ${row.count} ${input.strain} plant(s) (${row.phase}).`,
      data: {
        batch_number: row.batchNumber,
        count: row.count,
        phase: row.phase,
        strain: strain?.name ?? null,
      },
    };
  },
});

export const movePlantPhaseTool = defineTool({
  name: "move_plant_phase",
  description:
    "Advance (or set) a single plant's lifecycle phase. Identify the plant by its " +
    "tag (e.g. PLT-00001) or id. Valid phases: IMMATURE, VEGETATIVE, FLOWERING, HARVESTED, DESTROYED.",
  gate: "confirmation",
  inputSchema: z.object({
    plant: z.string().describe("Plant tag (e.g. PLT-00001) or plant id"),
    phase: z.enum(PHASES).describe("Target lifecycle phase"),
  }),
  async buildPreview(input) {
    return confirm(
      "Move plant phase",
      `Set plant ${input.plant} to ${input.phase}.`,
      [
        { label: "Plant", value: input.plant },
        { label: "New phase", value: input.phase },
      ],
      input.phase === "DESTROYED" ? "high" : "low",
    );
  },
  async execute(input, ctx) {
    // Resolve by tag first, then fall back to treating the input as an id.
    const { items } = await listPlants(ctx.service, { limit: 200 });
    const byTag = items.find((p) => p.plantTag.toLowerCase() === input.plant.trim().toLowerCase());
    const target = byTag ?? (await getPlant(ctx.service, input.plant));
    if (!target) return { ok: false, summary: `No plant found for "${input.plant}".` };
    try {
      const row = await movePlantPhase(ctx.service, target.id, input.phase);
      return {
        ok: true,
        summary: `Plant ${row.plantTag} moved to ${row.phase}.`,
        data: { plant_tag: row.plantTag, phase: row.phase },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Move failed." };
    }
  },
});

export const createHarvestTool = defineTool({
  name: "create_harvest",
  description:
    "Record a harvest for a strain (matched by name, created if new) with a plant " +
    "count and optional wet/dry weights and location. Defaults to ACTIVE status.",
  gate: "confirmation",
  inputSchema: z.object({
    strain: z.string().describe("Strain name; created if it does not exist"),
    name: z.string().optional().describe("Optional harvest name/label"),
    plant_count: z.number().int().min(0).optional().describe("Number of plants harvested"),
    wet_weight: z.number().optional().describe("Wet weight (grams)"),
    dry_weight: z.number().optional().describe("Dry weight (grams)"),
    location: z.string().optional().describe("Location/room name; created if new"),
  }),
  async buildPreview(input, ctx) {
    const strain = await resolveStrainId(ctx, input.strain);
    const location = await resolveLocationId(ctx, input.location);
    return confirm(
      "Create harvest",
      `Record a harvest of ${input.strain}.`,
      [
        { label: "Strain", value: strain?.name ?? input.strain },
        { label: "Name", value: input.name ?? "-" },
        { label: "Plants", value: input.plant_count != null ? String(input.plant_count) : "-" },
        { label: "Wet weight", value: input.wet_weight != null ? `${input.wet_weight} g` : "-" },
        { label: "Dry weight", value: input.dry_weight != null ? `${input.dry_weight} g` : "-" },
        { label: "Location", value: location?.name ?? "-" },
      ],
      "low",
    );
  },
  async execute(input, ctx) {
    const strain = await resolveStrainId(ctx, input.strain);
    const location = await resolveLocationId(ctx, input.location);
    const { row } = await upsertHarvest(ctx.service, {
      strainId: strain?.id ?? null,
      locationId: location?.id ?? null,
      name: input.name ?? null,
      plantCount: input.plant_count,
      wetWeight: input.wet_weight ?? null,
      dryWeight: input.dry_weight ?? null,
    });
    return {
      ok: true,
      summary: `Created harvest ${row.harvestNumber} (${input.strain}, ${row.status}).`,
      data: {
        harvest_number: row.harvestNumber,
        status: row.status,
        strain: strain?.name ?? null,
        plant_count: row.plantCount,
      },
    };
  },
});

export const listPlantBatchesTool = defineTool({
  name: "list_plant_batches",
  description: "List plant batches (batch number, count, phase). Returns compact summaries.",
  gate: "none",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listPlantBatches(ctx.service, { limit: input.limit ?? 25 });
    return {
      ok: true,
      summary: `${total} plant batch(es); showing ${items.length}.`,
      data: {
        total,
        batches: items.map((b) => ({
          batch_number: b.batchNumber,
          count: b.count,
          phase: b.phase,
          source_type: b.sourceType ?? null,
        })),
      },
    };
  },
});

export const listHarvestsTool = defineTool({
  name: "list_harvests",
  description: "List harvests (harvest number, plant count, weights, status). Returns compact summaries.",
  gate: "none",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listHarvests(ctx.service, { limit: input.limit ?? 25 });
    return {
      ok: true,
      summary: `${total} harvest(s); showing ${items.length}.`,
      data: {
        total,
        harvests: items.map((h) => ({
          harvest_number: h.harvestNumber,
          name: h.name ?? null,
          plant_count: h.plantCount,
          wet_weight: h.wetWeight,
          dry_weight: h.dryWeight,
          status: h.status,
        })),
      },
    };
  },
});

export const cultivationTools = [
  createPlantBatchTool,
  movePlantPhaseTool,
  createHarvestTool,
  listPlantBatchesTool,
  listHarvestsTool,
];
