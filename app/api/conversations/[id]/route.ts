import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import { getConversation } from "@/lib/services/conversations";
import { buildTranscript } from "@/lib/harness/transcript";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const conv = await getConversation(ctx, id);
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });
  const transcript = await buildTranscript(ctx, id);
  return NextResponse.json({ conversation: conv, ...transcript });
}
