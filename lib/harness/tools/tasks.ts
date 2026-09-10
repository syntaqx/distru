import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  getTask,
  listOrgMembers,
  listTasks,
  setTaskStatus,
  upsertTask,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/modules/platform";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "low",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

/** Resolve an assignee reference (name or email) to a member id + label. */
async function resolveAssignee(ctx: AgentContext, ref?: string) {
  if (!ref) return { id: null as string | null, label: null as string | null };
  const members = await listOrgMembers(ctx.service);
  const q = ref.trim().toLowerCase();
  const match =
    members.find((m) => m.email.toLowerCase() === q) ??
    members.find((m) => (m.name ?? "").toLowerCase() === q) ??
    members.find((m) => (m.name ?? "").toLowerCase().includes(q));
  return match ? { id: match.id, label: match.name || match.email } : { id: null, label: null };
}

/** Find a task within the org by id or a case-insensitive title match. */
async function findTask(ctx: AgentContext, ref: string) {
  const direct = await getTask(ctx.service, ref).catch(() => null);
  if (direct) return direct;
  const { items } = await listTasks(ctx.service, { limit: 500 });
  const q = ref.trim().toLowerCase();
  return (
    items.find((t) => t.title.toLowerCase() === q) ??
    items.find((t) => t.title.toLowerCase().includes(q)) ??
    null
  );
}

export const createTaskTool = defineTool({
  name: "create_task",
  description:
    "Create a task / to-do. Provide a title; optionally a description, status " +
    "(OPEN | IN_PROGRESS | DONE), priority (LOW | MEDIUM | HIGH), a due date " +
    "(ISO date like 2026-09-15), and an assignee matched by name or email. " +
    "Defaults to an OPEN, MEDIUM-priority task.",
  gate: "confirmation",
  inputSchema: z.object({
    title: z.string().min(1).describe("Short task title"),
    description: z.string().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    due_date: z.string().optional().describe("Due date, ISO 8601 (e.g. 2026-09-15)"),
    assignee: z.string().optional().describe("Assignee name or email"),
  }),
  async buildPreview(input, ctx) {
    const assignee = await resolveAssignee(ctx, input.assignee);
    const fields = [
      { label: "Title", value: input.title },
      { label: "Status", value: STATUS_LABEL[input.status ?? "OPEN"] },
      { label: "Priority", value: input.priority ?? "MEDIUM" },
    ];
    if (input.due_date) fields.push({ label: "Due", value: input.due_date });
    if (input.assignee)
      fields.push({ label: "Assignee", value: assignee.label ?? `${input.assignee} (unmatched)` });
    return confirm("Create task", `Create task "${input.title}".`, fields, "low");
  },
  async execute(input, ctx) {
    try {
      const assignee = await resolveAssignee(ctx, input.assignee);
      const { row } = await upsertTask(ctx.service, {
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueAt: input.due_date ?? null,
        assigneeId: assignee.id,
      });
      const warn =
        input.assignee && !assignee.id ? ` (assignee "${input.assignee}" not matched)` : "";
      return {
        ok: true,
        summary: `Created task "${row.title}" (${STATUS_LABEL[row.status] ?? row.status})${warn}.`,
        data: {
          id: row.id,
          title: row.title,
          status: row.status,
          priority: row.priority,
          due_date: row.dueAt ? row.dueAt.toISOString() : null,
          assignee: assignee.label,
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Task create failed." };
    }
  },
});

export const listTasksTool = defineTool({
  name: "list_tasks",
  description:
    "List tasks, optionally filtered by status (OPEN | IN_PROGRESS | DONE). Returns " +
    "compact summaries with title, status, priority, and due date.",
  gate: "none",
  inputSchema: z.object({
    status: z.enum(TASK_STATUSES).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  async execute(input, ctx) {
    const { items, total } = await listTasks(ctx.service, {
      status: input.status,
      limit: input.limit ?? 50,
    });
    return {
      ok: true,
      summary: `${total} task(s)${input.status ? ` with status ${input.status}` : ""}; showing ${items.length}.`,
      data: {
        total,
        tasks: items.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.dueAt ? t.dueAt.toISOString() : null,
        })),
      },
    };
  },
});

export const completeTaskTool = defineTool({
  name: "complete_task",
  description:
    "Mark a task as done. Identify the task by its id or by (part of) its title.",
  gate: "confirmation",
  inputSchema: z.object({
    task: z.string().min(1).describe("Task id or title"),
  }),
  async buildPreview(input, ctx) {
    const task = await findTask(ctx, input.task);
    if (!task) return confirm("Complete task", `Task "${input.task}" not found.`, [], "low");
    return confirm(
      "Complete task",
      `Mark "${task.title}" as done.`,
      [{ label: "Current status", value: STATUS_LABEL[task.status] ?? task.status }],
      "low",
    );
  },
  async execute(input, ctx) {
    const task = await findTask(ctx, input.task);
    if (!task) return { ok: false, summary: `Task "${input.task}" not found.` };
    try {
      const row = await setTaskStatus(ctx.service, task.id, "DONE");
      return {
        ok: true,
        summary: `Completed task "${row.title}".`,
        data: { id: row.id, title: row.title, status: row.status },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Task update failed." };
    }
  },
});

export const taskTools = [createTaskTool, listTasksTool, completeTaskTool];
