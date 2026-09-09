import { z } from "zod";
import { defineTool } from "../tool";
import type { HarnessToolPreview } from "../types";
import type { WorkflowGraph } from "@/lib/harness/graph/types";
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  runWorkflow,
} from "@/lib/harness/workflows";

/** Build a minimal graph (trigger -> agent) from a saved instruction. */
function instructionGraph(
  instruction: string,
  trigger: "manual" | "schedule",
  cron?: string,
  description?: string,
): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger",
        type: trigger === "schedule" ? "trigger.schedule" : "trigger.manual",
        name: trigger === "schedule" ? "Schedule" : "Manual trigger",
        params: trigger === "schedule" ? { cron: cron ?? "", description: description ?? "" } : {},
        position: { x: 80, y: 160 },
      },
      {
        id: "agent",
        type: "agent",
        name: "Agent",
        params: { instruction, maxSteps: 12 },
        position: { x: 360, y: 160 },
      },
    ],
    connections: { trigger: { main: [[{ node: "agent" }]] } },
  };
}

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

export const listWorkflowsTool = defineTool({
  name: "list_workflows",
  description:
    "List the org's saved automated workflows (Automations) with their trigger, " +
    "schedule, and the status of the last run.",
  gate: "none",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const rows = await listWorkflows(ctx.service);
    return {
      ok: true,
      summary: rows.length
        ? `${rows.length} workflow(s): ${rows.map((r) => r.name).join(", ")}.`
        : "No workflows saved yet.",
      data: {
        workflows: rows.map((r) => ({
          id: r.id,
          name: r.name,
          trigger: r.trigger,
          schedule: r.schedule,
          lastRunAt: r.lastRunAt,
          lastRunStatus: r.lastRunStatus,
        })),
      },
    };
  },
});

export const createWorkflowTool = defineTool({
  name: "create_workflow",
  description:
    "Save a reusable automated workflow as an editable node graph (a trigger wired " +
    "to an AI-agent node that runs the instruction). Runs on demand, or unattended " +
    "when scheduled. Use this when the user wants to automate a recurring task (e.g. " +
    "'every morning, flag SKUs under 10 units'). The instruction should be a complete, " +
    "self-contained task written for the agent to execute without a human present. The " +
    "user can then refine the graph - add tools, conditions, more steps - on the canvas.",
  gate: "confirmation",
  inputSchema: z.object({
    name: z.string().describe("Short human name, e.g. 'Low-stock report'"),
    instruction: z
      .string()
      .describe(
        "The full task the agent should perform each run, self-contained.",
      ),
    trigger: z.enum(["manual", "schedule"]).optional(),
    schedule: z
      .string()
      .optional()
      .describe("Human schedule when trigger=schedule, e.g. 'daily at 8am'"),
    cron: z
      .string()
      .optional()
      .describe("Standard 5-field cron (UTC) when trigger=schedule, e.g. '0 8 * * *'. Enables real auto-firing."),
  }),
  buildPreview(input) {
    return confirm(
      "Save workflow",
      `Save the automation "${input.name}".`,
      [
        { label: "Name", value: input.name },
        { label: "Trigger", value: input.trigger ?? "manual" },
        { label: "Schedule", value: input.schedule ?? "-" },
        { label: "Instruction", value: input.instruction },
      ],
      "low",
    );
  },
  async execute(input, ctx) {
    const trigger = input.trigger ?? "manual";
    const wf = await createWorkflow(ctx.service, {
      name: input.name,
      instruction: input.instruction,
      graph: instructionGraph(input.instruction, trigger, input.cron, input.schedule),
      createdBy: ctx.userId,
    });
    return {
      ok: true,
      summary: `Saved workflow "${wf.name}" as an editable node graph. Run it any time from the Automations page or with run_workflow.`,
      data: { id: wf.id, name: wf.name },
    };
  },
});

export const runWorkflowTool = defineTool({
  name: "run_workflow",
  description:
    "Run a saved workflow now. The workflow's instruction is executed by the " +
    "agent in unattended mode (its actions run without further approval), so " +
    "confirm with the user before running one that changes data.",
  gate: "confirmation",
  inputSchema: z.object({
    workflow_id: z.string().describe("The workflow id from list_workflows."),
  }),
  async buildPreview(input, ctx) {
    const wf = await getWorkflow(ctx.service, input.workflow_id);
    return confirm(
      "Run workflow",
      wf ? `Run "${wf.name}" now (unattended).` : "Run workflow.",
      [
        { label: "Name", value: wf?.name ?? input.workflow_id },
        { label: "Instruction", value: wf?.instruction ?? "-" },
      ],
      "high",
    );
  },
  async execute(input, ctx) {
    const run = await runWorkflow(ctx.service, input.workflow_id);
    return {
      ok: run.status === "success",
      summary:
        run.status === "success"
          ? `Workflow finished: ${run.summary}`
          : `Workflow failed: ${run.summary}`,
      data: { runId: run.id, status: run.status, summary: run.summary },
    };
  },
});

export const workflowTools = [
  listWorkflowsTool,
  createWorkflowTool,
  runWorkflowTool,
];
