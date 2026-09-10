import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  getAssembly,
  listAssemblies,
  upsertAssembly,
  type AssemblyLineInput,
} from "@/lib/modules/manufacturing";
import { resolveProduct } from "./_helpers";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

const lineSchema = z.object({
  product: z.string().describe("SKU or product name"),
  quantity: z.number().positive(),
});

type LineInput = z.infer<typeof lineSchema>;

/** Resolve a product reference into an assembly line + a label for the preview. */
async function resolveLines(ctx: AgentContext, items: LineInput[]) {
  const lines: AssemblyLineInput[] = [];
  const labels: string[] = [];
  const missing: string[] = [];
  for (const item of items) {
    const p = await resolveProduct(ctx.service, { sku: item.product, name: item.product });
    if (!p) {
      missing.push(item.product);
      labels.push(`${item.quantity} × ${item.product} (unmatched)`);
      lines.push({ productId: null, quantity: item.quantity });
      continue;
    }
    labels.push(`${item.quantity} × ${p.product.name} (${p.product.sku})`);
    lines.push({ productId: p.product.id, quantity: item.quantity });
  }
  return { lines, labels, missing };
}

export const createAssemblyTool = defineTool({
  name: "create_assembly",
  description:
    "Create a manufacturing assembly (build/work order) that consumes input " +
    "products and yields output products. Each product is matched by SKU or name. " +
    "Provide at least one output line; inputs are optional. Defaults to PENDING status.",
  gate: "confirmation",
  inputSchema: z.object({
    outputs: z.array(lineSchema).min(1).describe("Products produced by the assembly"),
    inputs: z.array(lineSchema).optional().describe("Products consumed by the assembly"),
    location: z.string().optional().describe("Location name for the build"),
    notes: z.string().optional(),
  }),
  async buildPreview(input, ctx) {
    const outputs = await resolveLines(ctx, input.outputs);
    const inputs = input.inputs ? await resolveLines(ctx, input.inputs) : { labels: [], missing: [] };
    const fields = [
      { label: "Outputs", value: outputs.labels.join("; ") },
      { label: "Inputs", value: inputs.labels.length ? inputs.labels.join("; ") : "-" },
    ];
    const missing = [...outputs.missing, ...inputs.missing];
    if (missing.length) fields.push({ label: "Unmatched", value: missing.join(", ") });
    return confirm(
      "Create assembly",
      `Build ${input.outputs.length} output(s) from ${input.inputs?.length ?? 0} input(s).`,
      fields,
      "low",
    );
  },
  async execute(input, ctx) {
    const outputs = await resolveLines(ctx, input.outputs);
    const inputs = input.inputs ? await resolveLines(ctx, input.inputs) : { lines: [], missing: [] };
    try {
      const { row } = await upsertAssembly(ctx.service, {
        outputs: outputs.lines,
        inputs: inputs.lines,
        notes: input.notes ?? null,
      });
      const missing = [...outputs.missing, ...("missing" in inputs ? inputs.missing : [])];
      const warn = missing.length ? ` (unmatched: ${missing.join(", ")})` : "";
      return {
        ok: true,
        summary: `Created assembly ${row.assemblyNumber} (${row.status})${warn}.`,
        data: {
          assembly_number: row.assemblyNumber,
          status: row.status,
          outputs: input.outputs.length,
          inputs: input.inputs?.length ?? 0,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Assembly create failed." };
    }
  },
});

export const listAssembliesTool = defineTool({
  name: "list_assemblies",
  description: "List manufacturing assemblies (assembly number, status). Returns compact summaries.",
  gate: "none",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listAssemblies(ctx.service, { limit: input.limit ?? 25 });
    return {
      ok: true,
      summary: `${total} assembly(ies); showing ${items.length}.`,
      data: {
        total,
        assemblies: items.map((a) => ({
          assembly_number: a.assemblyNumber,
          status: a.status,
          notes: a.notes ?? null,
        })),
      },
    };
  },
});

/** Find an assembly by its number (e.g. ASM-0001) within the org. */
async function findAssemblyByNumber(ctx: AgentContext, assemblyNumber: string) {
  const { items } = await listAssemblies(ctx.service, { limit: 200 });
  const match = items.find((a) => a.assemblyNumber === assemblyNumber);
  return match ? await getAssembly(ctx.service, match.id) : null;
}

export const completeAssemblyTool = defineTool({
  name: "complete_assembly",
  description:
    "Complete (run) a manufacturing assembly by its number. This posts inventory " +
    "for real: it consumes each input FIFO, rolls the input cost plus applied " +
    "labor/overhead into a per-unit output cost, and produces the outputs as " +
    "costed stock. Blocks if an input exceeds on-hand. Idempotent once posted.",
  gate: "confirmation",
  inputSchema: z.object({
    assembly_number: z.string().describe("The assembly number, e.g. ASM-0001"),
  }),
  async buildPreview(input, ctx) {
    const asm = await findAssemblyByNumber(ctx, input.assembly_number);
    if (!asm)
      return confirm("Complete assembly", `Assembly ${input.assembly_number} not found.`, [], "low");
    return confirm(
      "Complete assembly",
      `Run ${asm.assemblyNumber}: consume ${asm.inputs.length} input line(s), produce ${asm.outputs.length} output line(s), and post inventory.`,
      [
        { label: "Status", value: asm.status },
        { label: "Already posted", value: asm.inventoryPosted ? "yes" : "no" },
      ],
      "medium",
    );
  },
  async execute(input, ctx) {
    const asm = await findAssemblyByNumber(ctx, input.assembly_number);
    if (!asm)
      return { ok: false, summary: `Assembly ${input.assembly_number} not found.` };
    try {
      await upsertAssembly(ctx.service, { id: asm.id, status: "COMPLETED" });
      const done = await getAssembly(ctx.service, asm.id);
      const outputs = done?.outputs ?? [];
      const unitCost = outputs[0]?.unitCost ?? null;
      return {
        ok: true,
        summary: `Completed ${asm.assemblyNumber}: inputs consumed, ${outputs.length} output(s) produced${unitCost ? ` at ${unitCost}/unit` : ""}.`,
        data: {
          assembly_number: asm.assemblyNumber,
          status: "COMPLETED",
          output_unit_cost: unitCost,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Assembly completion failed." };
    }
  },
});

export const manufacturingTools = [createAssemblyTool, completeAssemblyTool, listAssembliesTool];
