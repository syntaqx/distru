import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages, toolCalls } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import type { HarnessToolPreview } from "./types";

export type MessageRow = typeof messages.$inferSelect;
export type ToolCallRow = typeof toolCalls.$inferSelect;

export async function createConversation(
  ctx: ServiceCtx,
  input: { userId?: string | null; title?: string },
) {
  const [row] = await db
    .insert(conversations)
    .values({
      organizationId: ctx.orgId,
      userId: input.userId ?? null,
      title: input.title ?? "New conversation",
    })
    .returning();
  return row;
}

export async function listConversations(ctx: ServiceCtx) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.organizationId, ctx.orgId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversation(ctx: ServiceCtx, id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.organizationId, ctx.orgId), eq(conversations.id, id)),
    )
    .limit(1);
  return row ?? null;
}

export async function renameConversation(
  ctx: ServiceCtx,
  id: string,
  title: string,
) {
  await db
    .update(conversations)
    .set({ title })
    .where(
      and(eq(conversations.organizationId, ctx.orgId), eq(conversations.id, id)),
    );
}

export async function loadMessages(ctx: ServiceCtx, conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, ctx.orgId),
        eq(messages.conversationId, conversationId),
      ),
    )
    .orderBy(asc(messages.id));
}

/** Convert stored rows into Anthropic MessageParams for replay. */
export function toMessageParams(rows: MessageRow[]): Anthropic.MessageParam[] {
  return rows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content as Anthropic.ContentBlockParam[],
  }));
}

export async function appendMessage(
  ctx: ServiceCtx,
  conversationId: string,
  role: "user" | "assistant",
  content: unknown[],
) {
  const [row] = await db
    .insert(messages)
    .values({
      organizationId: ctx.orgId,
      conversationId,
      role,
      content,
    })
    .returning();
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
  return row;
}

// ---------------- Tool calls ----------------

export async function recordToolCall(
  ctx: ServiceCtx,
  input: {
    conversationId: string;
    toolUseId: string;
    name: string;
    inputJson: Record<string, unknown>;
    status: "pending" | "executed" | "error" | "auto" | "rejected";
    requiresConfirmation: boolean;
    preview?: HarnessToolPreview | null;
    output?: unknown;
  },
) {
  const [row] = await db
    .insert(toolCalls)
    .values({
      organizationId: ctx.orgId,
      conversationId: input.conversationId,
      toolUseId: input.toolUseId,
      name: input.name,
      input: input.inputJson,
      status: input.status,
      requiresConfirmation: String(input.requiresConfirmation),
      preview: input.preview ?? null,
      output: input.output ?? null,
    })
    .returning();
  return row;
}

/**
 * True if the conversation has a gated tool call still awaiting a decision. A new
 * message turn must not start until it's resolved, or the open `tool_use` would be
 * left without a `tool_result` and the message sequence would break.
 */
export async function hasPendingToolCalls(ctx: ServiceCtx, conversationId: string) {
  const [row] = await db
    .select({ id: toolCalls.id })
    .from(toolCalls)
    .where(
      and(
        eq(toolCalls.organizationId, ctx.orgId),
        eq(toolCalls.conversationId, conversationId),
        eq(toolCalls.status, "pending"),
      ),
    )
    .limit(1);
  return !!row;
}

export async function getToolCall(ctx: ServiceCtx, toolUseId: string) {
  const [row] = await db
    .select()
    .from(toolCalls)
    .where(
      and(
        eq(toolCalls.organizationId, ctx.orgId),
        eq(toolCalls.toolUseId, toolUseId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updateToolCall(
  ctx: ServiceCtx,
  toolUseId: string,
  patch: Partial<{
    status: string;
    output: unknown;
    decision: string;
    decidedBy: string | null;
    decidedAt: Date;
  }>,
) {
  await db
    .update(toolCalls)
    .set(patch)
    .where(
      and(
        eq(toolCalls.organizationId, ctx.orgId),
        eq(toolCalls.toolUseId, toolUseId),
      ),
    );
}
