import type { ServiceCtx } from "@/lib/modules/shared";
import { db } from "@/db";
import { toolCalls } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { loadMessages } from "@/lib/harness/conversations";
import type { HarnessToolPreview, Interrupt } from "./types";

export type DisplayItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      toolUseId: string;
      name: string;
      status: string;
      ok: boolean | null;
      summary: string | null;
      preview: HarnessToolPreview | null;
      input: Record<string, unknown>;
      data: unknown;
    };

export type Transcript = { items: DisplayItem[]; pending: Interrupt[] };

type Block = { type: string; text?: string; id?: string; name?: string };

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as Block[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
}

/** Rebuild a display transcript for a conversation from stored messages + tool calls. */
export async function buildTranscript(
  ctx: ServiceCtx,
  conversationId: string,
): Promise<Transcript> {
  const [msgs, calls] = await Promise.all([
    loadMessages(ctx, conversationId),
    db
      .select()
      .from(toolCalls)
      .where(
        and(
          eq(toolCalls.organizationId, ctx.orgId),
          eq(toolCalls.conversationId, conversationId),
        ),
      ),
  ]);
  const callByUse = new Map(calls.map((c) => [c.toolUseId, c]));

  const items: DisplayItem[] = [];
  const pending: Interrupt[] = [];

  for (const m of msgs) {
    const blocks = (m.content as Block[]) ?? [];
    if (m.role === "user") {
      // Skip internal tool_result user messages.
      if (blocks.some((b) => b.type === "tool_result")) continue;
      const text = textOf(m.content);
      if (text.trim()) items.push({ kind: "user", id: m.id, text });
      continue;
    }
    // assistant
    const text = textOf(m.content);
    if (text.trim()) items.push({ kind: "assistant", id: m.id, text });
    for (const b of blocks) {
      if (b.type !== "tool_use" || !b.id) continue;
      const call = callByUse.get(b.id);
      const output = call?.output as { ok?: boolean; summary?: string; data?: unknown } | null;
      items.push({
        kind: "tool",
        id: `${m.id}:${b.id}`,
        toolUseId: b.id,
        name: b.name ?? call?.name ?? "tool",
        status: call?.status ?? "unknown",
        ok: output?.ok ?? null,
        summary: output?.summary ?? null,
        preview: (call?.preview as HarnessToolPreview | null) ?? null,
        input: (call?.input as Record<string, unknown>) ?? {},
        data: output?.data ?? null,
      });
      if (call?.status === "pending" && call.preview) {
        pending.push({
          toolUseId: b.id,
          name: b.name ?? call.name,
          preview: call.preview as HarnessToolPreview,
        });
      }
    }
  }

  return { items, pending };
}
