import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  getAssembly,
  listAssemblies,
  upsertAssembly,
} from "@/lib/modules/manufacturing";

/**
 * Production-scheduling tools for the manufacturing module: put a planned window
 * (+ estimated effort and an assignee) on an assembly, and read back the
 * upcoming planned/in-progress runs. Completing a run still goes through
 * `complete_assembly`; scheduling only annotates the plan.
 */

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "low",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

/** Find an assembly by its number (e.g. ASM-0001) within the org. */
async function findAssemblyByNumber(ctx: AgentContext, assemblyNumber: string) {
  const { items } = await listAssemblies(ctx.service, { limit: 200 });
  const match = items.find((a) => a.assemblyNumber === assemblyNumber);
  return match ? await getAssembly(ctx.service, match.id) : null;
}

const dateField = z
  .string()
  .describe("ISO 8601 date/time, e.g. 2026-09-15 or 2026-09-15T09:00:00Z");

export const scheduleAssemblyTool = defineTool({
  name: "schedule_assembly",
  description:
    "Schedule a manufacturing assembly (build/work order) by its number: set its " +
    "planned start/end window, estimated work minutes, and who it is assigned to. " +
    "Does not start or complete the run - it stays PENDING (a scheduled/planned run) " +
    "until it is moved to IN_PROGRESS and then completed.",
  gate: "confirmation",
  inputSchema: z.object({
    assembly_number: z.string().describe("The assembly number, e.g. ASM-0001"),
    scheduled_start: dateField.optional(),
    scheduled_end: dateField.optional(),
    estimated_work_minutes: z.number().int().positive().optional(),
    assigned_to: z.string().optional().describe("Operator or crew name"),
  }),
  async buildPreview(input, ctx) {
    const asm = await findAssemblyByNumber(ctx, input.assembly_number);
    if (!asm)
      return confirm("Schedule assembly", `Assembly ${input.assembly_number} not found.`, []);
    const fields = [
      { label: "Assembly", value: asm.assemblyNumber },
      { label: "Start", value: input.scheduled_start ?? "-" },
      { label: "End", value: input.scheduled_end ?? "-" },
      {
        label: "Est. minutes",
        value: input.estimated_work_minutes != null ? String(input.estimated_work_minutes) : "-",
      },
      { label: "Assigned to", value: input.assigned_to ?? "-" },
    ];
    return confirm(
      "Schedule assembly",
      `Set the planned window for ${asm.assemblyNumber}.`,
      fields,
    );
  },
  async execute(input, ctx) {
    const asm = await findAssemblyByNumber(ctx, input.assembly_number);
    if (!asm) return { ok: false, summary: `Assembly ${input.assembly_number} not found.` };
    try {
      await upsertAssembly(ctx.service, {
        id: asm.id,
        scheduledStart: input.scheduled_start ?? undefined,
        scheduledEnd: input.scheduled_end ?? undefined,
        estimatedWorkMinutes: input.estimated_work_minutes ?? undefined,
        assignedTo: input.assigned_to ?? undefined,
      });
      return {
        ok: true,
        summary: `Scheduled ${asm.assemblyNumber}${input.scheduled_start ? ` for ${input.scheduled_start}` : ""}${input.assigned_to ? `, assigned to ${input.assigned_to}` : ""}.`,
        data: {
          assembly_number: asm.assemblyNumber,
          scheduled_start: input.scheduled_start ?? null,
          scheduled_end: input.scheduled_end ?? null,
          estimated_work_minutes: input.estimated_work_minutes ?? null,
          assigned_to: input.assigned_to ?? null,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Scheduling failed." };
    }
  },
});

export const listScheduledAssembliesTool = defineTool({
  name: "list_scheduled_assemblies",
  description:
    "List upcoming planned/in-progress manufacturing runs that have a scheduled " +
    "start, soonest first. Returns compact summaries (number, status, scheduled " +
    "window, assignee).",
  gate: "none",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).optional(),
    include_completed: z
      .boolean()
      .optional()
      .describe("Include COMPLETED/CANCELED runs (default false)"),
  }),
  async execute(input, ctx) {
    const { items } = await listAssemblies(ctx.service, { limit: 200 });
    const open = new Set(["PENDING", "IN_PROGRESS"]);
    const scheduled = items
      .filter((a) => a.scheduledStart != null)
      .filter((a) => (input.include_completed ? true : open.has(a.status)))
      .sort(
        (a, b) =>
          new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime(),
      )
      .slice(0, input.limit ?? 25);
    return {
      ok: true,
      summary: `${scheduled.length} scheduled run(s).`,
      data: {
        assemblies: scheduled.map((a) => ({
          assembly_number: a.assemblyNumber,
          status: a.status,
          scheduled_start: a.scheduledStart ? new Date(a.scheduledStart).toISOString() : null,
          scheduled_end: a.scheduledEnd ? new Date(a.scheduledEnd).toISOString() : null,
          estimated_work_minutes: a.estimatedWorkMinutes ?? null,
          assigned_to: a.assignedTo ?? null,
        })),
      },
    };
  },
});

export const schedulingTools = [scheduleAssemblyTool, listScheduledAssembliesTool];
