import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifacts } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";

export type ArtifactRow = typeof artifacts.$inferSelect;
export type Delivery = { destination: string; target: string; externalId: string | null; at: string };

export async function createArtifact(
  ctx: ServiceCtx,
  input: {
    title: string;
    content: string;
    kind?: string;
    format?: string;
    workflowId?: string | null;
    conversationId?: string | null;
  },
): Promise<ArtifactRow> {
  const [row] = await db
    .insert(artifacts)
    .values({
      organizationId: ctx.orgId,
      title: input.title,
      content: input.content,
      kind: input.kind ?? "report",
      format: input.format ?? "markdown",
      workflowId: input.workflowId ?? null,
      conversationId: input.conversationId ?? null,
      createdBy: ctx.actor,
    })
    .returning();
  return row;
}

export async function listArtifacts(
  ctx: ServiceCtx,
  opts?: { limit?: number; workflowRunId?: string },
): Promise<ArtifactRow[]> {
  const where = opts?.workflowRunId
    ? and(eq(artifacts.organizationId, ctx.orgId), eq(artifacts.workflowRunId, opts.workflowRunId))
    : eq(artifacts.organizationId, ctx.orgId);
  return db
    .select()
    .from(artifacts)
    .where(where)
    .orderBy(desc(artifacts.createdAt))
    .limit(opts?.limit ?? 100);
}

export async function getArtifact(ctx: ServiceCtx, id: string): Promise<ArtifactRow | null> {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.organizationId, ctx.orgId), eq(artifacts.id, id)))
    .limit(1);
  return row ?? null;
}

/** Append a delivery record (email sent / uploaded to Drive) to an artifact. */
export async function recordDelivery(ctx: ServiceCtx, id: string, delivery: Delivery): Promise<void> {
  await db
    .update(artifacts)
    .set({ deliveries: sql`${artifacts.deliveries} || ${JSON.stringify([delivery])}::jsonb` })
    .where(and(eq(artifacts.organizationId, ctx.orgId), eq(artifacts.id, id)));
}

/**
 * Attribute the artifacts a run produced to that run. Agent nodes create their
 * artifacts inside their own conversation, so after the run we stamp every
 * as-yet-unlinked artifact from those conversations with the run + workflow id.
 */
export async function linkArtifactsToRun(
  ctx: ServiceCtx,
  runId: string,
  workflowId: string,
  conversationIds: string[],
): Promise<void> {
  if (conversationIds.length === 0) return;
  await db
    .update(artifacts)
    .set({ workflowRunId: runId, workflowId })
    .where(
      and(
        eq(artifacts.organizationId, ctx.orgId),
        isNull(artifacts.workflowRunId),
        inArray(artifacts.conversationId, conversationIds),
      ),
    );
}
