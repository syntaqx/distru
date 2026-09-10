import { getOrgContext } from "@/lib/session";
import { listTasks, listOrgMembers } from "@/lib/modules/platform";
import { listCompanies } from "@/lib/modules/catalog";
import { listOrders } from "@/lib/modules/sales";
import { TasksManager, type TaskView } from "@/components/tasks/tasks-manager";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items }, members, companies, orders] = await Promise.all([
    listTasks(service, { limit: 500 }),
    listOrgMembers(service),
    listCompanies(service),
    listOrders(service, { limit: 200 }),
  ]);

  const memberName = new Map(members.map((m) => [m.id, m.name || m.email]));
  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const orderName = new Map(orders.items.map((o) => [o.order.id, o.order.orderNumber]));

  const rows: TaskView[] = items.map((t) => {
    let link: TaskView["link"] = null;
    if (t.entityType && t.entityId) {
      const label =
        t.entityType === "company"
          ? companyName.get(t.entityId)
          : t.entityType === "order"
            ? orderName.get(t.entityId)
            : undefined;
      link = { type: t.entityType, id: t.entityId, label: label ?? "Linked record" };
    }
    return {
      id: t.id,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt ? t.dueAt.toISOString() : null,
      assigneeId: t.assigneeId ?? null,
      assigneeName: t.assigneeId ? (memberName.get(t.assigneeId) ?? null) : null,
      link,
    };
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Calendar &amp; Tasks</h1>
        <p className="text-sm text-muted">
          Plan the work - track to-dos across a board or a calendar, assign them to your team, and
          link them to companies and orders.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <TasksManager rows={rows} />
      </div>
    </div>
  );
}
