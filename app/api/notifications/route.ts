import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/session";
import {
  listNotifications,
  markRead,
  unreadCount,
} from "@/lib/modules/notifications";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const [rows, unread] = await Promise.all([
    listNotifications(service, ctx.userId),
    unreadCount(service, ctx.userId),
  ]);
  return NextResponse.json({
    unread,
    notifications: rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; all?: boolean };
  await markRead(service, ctx.userId, { ids: body.ids, all: body.all });
  return NextResponse.json({ ok: true });
}
