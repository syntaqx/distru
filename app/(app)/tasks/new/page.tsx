import { getOrgContext } from "@/lib/session";
import { listOrgMembers } from "@/lib/modules/platform";
import { listCompanies } from "@/lib/modules/catalog";
import { listOrders } from "@/lib/modules/sales";
import { TaskForm } from "@/components/tasks/task-form";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

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
            title: "",
            description: "",
            status: "OPEN",
            priority: "MEDIUM",
            dueAt: null,
            assigneeId: "",
            entityType: null,
            entityId: null,
          }}
          members={members.map((m) => ({ id: m.id, name: m.name || m.email }))}
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          orders={orders.items.map((o) => ({ id: o.order.id, name: o.order.orderNumber }))}
        />
      </div>
    </div>
  );
}
