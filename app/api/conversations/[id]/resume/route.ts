import { getOrgContext } from "@/lib/session";
import { getConversation } from "@/lib/harness/conversations";
import { resumeConversationTurn } from "@/lib/harness/runner";
import { ndjsonStream } from "@/lib/harness/stream";
import type { ToolDecision } from "@/lib/harness/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const conv = await getConversation(ctx, id);
  if (!conv) return new Response("not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    decisions?: ToolDecision[];
  };
  const decisions = body.decisions ?? [];

  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  return ndjsonStream(async (emit) => {
    await resumeConversationTurn(
      { service, userId: ctx.userId, conversationId: id, emit },
      decisions,
    );
  });
}
