import { and, desc, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { workflowRuns, workflows } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { createConversation, appendMessage } from "./conversations";
import { runConversationTurn } from "./runner";
import { runGraph } from "./graph/executor";
import { normalizeGraph } from "./graph/validate";
import { deriveSchedule, nextRunFromCron } from "./graph/schedule";
import type { WorkflowGraph } from "./graph/types";
import type { HarnessEvent } from "./types";
import { linkArtifactsToRun } from "@/lib/modules/reports";
import { createNotification } from "@/lib/modules/notifications";

/** Drop an in-app notification when a run finishes, linking to its results. */
async function notifyRunFinished(
  ctx: ServiceCtx,
  wf: WorkflowRow,
  run: { id: string; status: string; summary: string | null },
) {
  await createNotification(ctx, {
    userId: wf.createdBy,
    kind: run.status === "success" ? "workflow.success" : "workflow.error",
    title: `${wf.name} ${run.status === "success" ? "finished" : "failed"}`,
    body: run.summary?.replace(/[*_`#>|]/g, "").slice(0, 140) ?? null,
    href: `/automations?wf=${wf.id}&run=${run.id}`,
  });
}

/** Derive the schedule columns (trigger/schedule/nextRunAt) from a graph. */
function scheduleFields(graph: WorkflowGraph | null | undefined) {
  const s = deriveSchedule(graph);
  if (!s.isScheduled) {
    return { trigger: "manual", schedule: null as string | null, nextRunAt: null as Date | null };
  }
  return {
    trigger: "schedule",
    schedule: s.description,
    nextRunAt: s.cron ? nextRunFromCron(s.cron) : null,
  };
}

export type WorkflowRow = typeof workflows.$inferSelect;
export type WorkflowRunRow = typeof workflowRuns.$inferSelect;

export async function listWorkflows(ctx: ServiceCtx): Promise<WorkflowRow[]> {
  return db
    .select()
    .from(workflows)
    .where(eq(workflows.organizationId, ctx.orgId))
    .orderBy(desc(workflows.updatedAt));
}

export async function getWorkflow(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.organizationId, ctx.orgId), eq(workflows.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createWorkflow(
  ctx: ServiceCtx,
  input: {
    name: string;
    instruction?: string;
    trigger?: "manual" | "schedule";
    schedule?: string | null;
    graph?: WorkflowGraph | null;
    createdBy?: string | null;
  },
): Promise<WorkflowRow> {
  const graph = input.graph ? normalizeGraph(input.graph) : null;
  const sched = graph ? scheduleFields(graph) : null;
  const [row] = await db
    .insert(workflows)
    .values({
      organizationId: ctx.orgId,
      name: input.name,
      instruction: input.instruction ?? "",
      trigger: sched?.trigger ?? input.trigger ?? "manual",
      schedule: sched ? sched.schedule : input.schedule ?? null,
      graph,
      nextRunAt: sched?.nextRunAt ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row;
}

export async function updateWorkflow(
  ctx: ServiceCtx,
  id: string,
  patch: {
    name?: string;
    instruction?: string;
    trigger?: string;
    schedule?: string | null;
    graph?: WorkflowGraph | null;
    nextRunAt?: Date | null;
  },
): Promise<WorkflowRow | null> {
  const set: Partial<typeof workflows.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.instruction !== undefined) set.instruction = patch.instruction;
  if (patch.trigger !== undefined) set.trigger = patch.trigger;
  if (patch.schedule !== undefined) set.schedule = patch.schedule;
  if (patch.graph !== undefined) {
    const graph = patch.graph ? normalizeGraph(patch.graph) : null;
    set.graph = graph;
    // Saving a graph re-derives its schedule (and re-arms nextRunAt).
    const sched = scheduleFields(graph);
    set.trigger = sched.trigger;
    set.schedule = sched.schedule;
    set.nextRunAt = sched.nextRunAt;
  }
  if (patch.nextRunAt !== undefined) set.nextRunAt = patch.nextRunAt;
  if (Object.keys(set).length === 0) return getWorkflow(ctx, id);
  const [row] = await db
    .update(workflows)
    .set(set)
    .where(and(eq(workflows.organizationId, ctx.orgId), eq(workflows.id, id)))
    .returning();
  return row ?? null;
}

/**
 * Every scheduled workflow whose next run is due - queried across all orgs, for
 * the system scheduler (tick endpoint). Not org-scoped: the caller is trusted.
 */
export async function listDueWorkflows(now: Date = new Date()): Promise<WorkflowRow[]> {
  return db
    .select()
    .from(workflows)
    .where(
      and(
        eq(workflows.trigger, "schedule"),
        isNotNull(workflows.nextRunAt),
        lte(workflows.nextRunAt, now),
      ),
    );
}

/** Advance a scheduled workflow's nextRunAt after it fires. */
export async function advanceSchedule(wf: WorkflowRow) {
  const { cron } = deriveSchedule(wf.graph);
  const next = cron ? nextRunFromCron(cron) : null;
  await db.update(workflows).set({ nextRunAt: next }).where(eq(workflows.id, wf.id));
  return next;
}

export async function deleteWorkflow(ctx: ServiceCtx, id: string) {
  // workflow_runs cascade on workflow delete (FK onDelete: cascade).
  await db
    .delete(workflows)
    .where(and(eq(workflows.organizationId, ctx.orgId), eq(workflows.id, id)));
}

export async function listRuns(
  ctx: ServiceCtx,
  workflowId: string,
  limit = 10,
): Promise<WorkflowRunRow[]> {
  return db
    .select()
    .from(workflowRuns)
    .where(
      and(
        eq(workflowRuns.organizationId, ctx.orgId),
        eq(workflowRuns.workflowId, workflowId),
      ),
    )
    .orderBy(desc(workflowRuns.createdAt))
    .limit(limit);
}

/**
 * Execute a workflow headlessly. This is the trigger-agnostic harness realized:
 * the exact same runner that powers the chat Copilot runs the saved instruction,
 * but in `autoApprove` mode - since no human is present to approve mutations, the
 * gate executes immediately and every action is attributed to `workflow:<id>` in
 * the audit log. Returns the finished run row.
 */
export async function runWorkflow(
  ctx: ServiceCtx,
  workflowId: string,
  opts?: { trigger?: string; triggerData?: Record<string, unknown> },
): Promise<WorkflowRunRow> {
  const wf = await getWorkflow(ctx, workflowId);
  if (!wf) throw new Error("Workflow not found.");

  // Attribute everything this run does to the workflow, not a user.
  const runCtx: ServiceCtx = {
    orgId: ctx.orgId,
    actor: `workflow:${wf.id}`,
    actorType: "system",
  };

  // Graph-native workflows run through the node executor.
  if (wf.graph && Array.isArray(wf.graph.nodes) && wf.graph.nodes.length > 0) {
    const [run] = await db
      .insert(workflowRuns)
      .values({
        organizationId: ctx.orgId,
        workflowId: wf.id,
        status: "running",
        trigger: opts?.trigger ?? "manual",
      })
      .returning();

    let result;
    try {
      result = await runGraph(runCtx, wf.graph, {
        workflowName: wf.name,
        triggerData: opts?.triggerData,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Workflow run failed.";
      const [failed] = await db
        .update(workflowRuns)
        .set({ status: "error", summary: message, finishedAt: new Date() })
        .where(eq(workflowRuns.id, run.id))
        .returning();
      await db
        .update(workflows)
        .set({ lastRunAt: new Date(), lastRunStatus: "error" })
        .where(eq(workflows.id, wf.id));
      await notifyRunFinished(ctx, wf, failed);
      return failed;
    }

    const finishedAt = new Date();
    const [finished] = await db
      .update(workflowRuns)
      .set({
        status: result.status,
        summary: result.summary,
        conversationId: result.conversationId,
        nodeRuns: result.nodeRuns,
        finishedAt,
      })
      .where(eq(workflowRuns.id, run.id))
      .returning();
    await db
      .update(workflows)
      .set({ lastRunAt: finishedAt, lastRunStatus: result.status })
      .where(eq(workflows.id, wf.id));

    // Attribute any reports the agent nodes produced to this run, then notify.
    const convIds = result.nodeRuns
      .map((r) => r.conversationId)
      .filter((c): c is string => !!c);
    await linkArtifactsToRun(ctx, run.id, wf.id, convIds);
    await notifyRunFinished(ctx, wf, finished);
    return finished;
  }

  // ---- Legacy path: a single saved instruction, run as one agent turn. ----
  const conv = await createConversation(runCtx, {
    userId: null,
    title: `Workflow: ${wf.name}`,
  });

  const [run] = await db
    .insert(workflowRuns)
    .values({
      organizationId: ctx.orgId,
      workflowId: wf.id,
      status: "running",
      conversationId: conv.id,
      trigger: opts?.trigger ?? "manual",
    })
    .returning();

  await appendMessage(runCtx, conv.id, "user", [
    {
      type: "text",
      text:
        `[Automated workflow run: "${wf.name}"]\n\n${wf.instruction}\n\n` +
        `[System: This is an unattended workflow. Take the actions needed to ` +
        `complete the task, then finish with a short summary of what you did.]`,
    },
  ]);

  // Capture streamed events to derive a run summary + status.
  let assistantText = "";
  let actionCount = 0;
  let errorMessage: string | null = null;

  const emit = (event: HarnessEvent) => {
    if (event.type === "token") assistantText += event.text;
    else if (event.type === "tool_result") {
      // A tool ran, so a fresh assistant turn follows; keep only the final
      // narration as the run summary (drop the "I'll go do X" preamble).
      if (event.ok) actionCount += 1;
      assistantText = "";
    } else if (event.type === "error") errorMessage = event.message;
  };

  try {
    await runConversationTurn(
      { service: runCtx, userId: null, conversationId: conv.id, emit },
      { autoApprove: true },
    );
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Workflow run failed.";
  }

  const status = errorMessage ? "error" : "success";
  const summary =
    errorMessage ??
    (assistantText.trim().slice(0, 600) ||
      `Completed with ${actionCount} action${actionCount === 1 ? "" : "s"}.`);
  const finishedAt = new Date();

  const [finished] = await db
    .update(workflowRuns)
    .set({ status, summary, finishedAt })
    .where(eq(workflowRuns.id, run.id))
    .returning();

  await db
    .update(workflows)
    .set({ lastRunAt: finishedAt, lastRunStatus: status })
    .where(eq(workflows.id, wf.id));

  await linkArtifactsToRun(ctx, run.id, wf.id, [conv.id]);
  await notifyRunFinished(ctx, wf, finished);
  return finished;
}
