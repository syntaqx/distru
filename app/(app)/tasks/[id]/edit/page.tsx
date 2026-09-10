import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getTask, listOrgMembers } from "@/lib/modules/platform";
import { listCompanies } from "@/lib/modules/catalog";
import { listOrders } from "@/lib/modules/sales";
import { TaskForm } from "@/components/tasks/task-form";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const t = await getTask(service, id);
  if (!t) notFound();

  const [members, companies, orders] = await Promise.all([
    listOrgMembers(service),
    listCompanies(service),
    listOrders(service, { limit: 200 }),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <TaskForm
          initial={{
            id: t.id,
            title: t.title,
            description: t.description ?? "",
            status: t.status,
            priority: t.priority,
            dueAt: t.dueAt ? t.dueAt.toISOString() : null,
            assigneeId: t.assigneeId ?? "",
            entityType: t.entityType ?? null,
            entityId: t.entityId ?? null,
          }}
          members={members.map((m) => ({ id: m.id, name: m.name || m.email }))}
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          orders={orders.items.map((o) => ({ id: o.order.id, name: o.order.orderNumber }))}
        />
      </div>
    </div>
  );
}
