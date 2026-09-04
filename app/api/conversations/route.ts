import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import {
  createConversation,
  listConversations,
} from "@/lib/services/conversations";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listConversations(ctx);
  return NextResponse.json({ conversations: rows });
}

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const conv = await createConversation(ctx, {
    userId: ctx.userId,
    title: body.title,
  });
  return NextResponse.json({ conversation: conv });
}
