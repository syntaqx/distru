import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workflowRuns, workflows } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { createConversation, appendMessage } from "./conversations";
import { runConversationTurn } from "./runner";
import type { HarnessEvent } from "./types";

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
    instruction: string;
    trigger?: "manual" | "schedule";
    schedule?: string | null;
    createdBy?: string | null;
  },
): Promise<WorkflowRow> {
  const [row] = await db
    .insert(workflows)
    .values({
      organizationId: ctx.orgId,
      name: input.name,
      instruction: input.instruction,
      trigger: input.trigger ?? "manual",
      schedule: input.schedule ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row;
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
): Promise<WorkflowRunRow> {
  const wf = await getWorkflow(ctx, workflowId);
  if (!wf) throw new Error("Workflow not found.");

  // Attribute everything this run does to the workflow, not a user.
  const runCtx: ServiceCtx = {
    orgId: ctx.orgId,
    actor: `workflow:${wf.id}`,
    actorType: "system",
  };

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

  return finished;
}
