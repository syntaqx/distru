import { getOrgContext } from "@/lib/session";
import { listNotifications } from "@/lib/modules/notifications";
import { NotificationsView, type NotifLite } from "@/components/notifications/notifications-view";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const rows = await listNotifications(service, ctx.userId, 200);
  const items: NotifLite[] = rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Notifications</h1>
        <p className="text-sm text-muted">
          Everything the platform wants you to know - workflow runs, delivered reports, and more. The
          topbar bell shows the latest; this is your full inbox.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <NotificationsView initial={items} />
      </div>
    </div>
  );
}
