import { getOrgContext } from "@/lib/session";
import { hasAnthropicKey } from "@/lib/anthropic";
import {
  appendMessage,
  getConversation,
  renameConversation,
} from "@/lib/services/conversations";
import { getFile, getJob } from "@/lib/services/imports";
import { runConversationTurn } from "@/lib/harness/runner";
import { ndjsonStream } from "@/lib/harness/stream";

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
    text?: string;
    importJobId?: string;
    pageContext?: string | null;
  };

  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  let text = (body.text ?? "").trim();

  // Tell the agent which page the user is looking at (the dock is context-aware).
  if (body.pageContext) {
    text += `\n\n[System: The user is currently viewing the ${body.pageContext} page.]`;
  }

  // If a file was attached, fold its import-job context into the message so the
  // agent can drive the import flow.
  if (body.importJobId) {
    const job = await getJob(service, body.importJobId);
    const file = job ? await getFile(service, job.fileId) : null;
    if (job && file) {
      if (!text) text = "I uploaded a file.";
      text +=
        `\n\n[System: A file was uploaded. import_job_id="${job.id}", ` +
        `file="${file.filename}", ${file.rowCount} rows. ` +
        `Columns: ${file.headers.join(", ")}. Detect what this file is, confirm with the ` +
        `user what they want to do with it, then drive that flow.]`;
    }
  }

  if (!text) return new Response("empty message", { status: 400 });

  await appendMessage(service, id, "user", [{ type: "text", text }]);

  // Give the conversation a title from the first user message.
  if (conv.title === "New conversation") {
    const title = text.split("\n")[0].slice(0, 60);
    await renameConversation(service, id, title || "New conversation");
  }

  if (!hasAnthropicKey()) {
    return ndjsonStream(async (emit) => {
      emit({
        type: "error",
        message:
          "ANTHROPIC_API_KEY is not set. Add it to .env to enable the agent.",
      });
    });
  }

  return ndjsonStream(async (emit) => {
    await runConversationTurn({
      service,
      userId: ctx.userId,
      conversationId: id,
      emit,
    });
  });
}
