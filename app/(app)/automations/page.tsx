import { getOrgContext } from "@/lib/session";
import { listRuns, listWorkflows } from "@/lib/harness/workflows";
import { AutomationsManager, type WorkflowLite } from "@/components/automations/automations-manager";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const workflows = await listWorkflows(service);
  const withRuns: WorkflowLite[] = await Promise.all(
    workflows.map(async (w) => ({
      id: w.id,
      name: w.name,
      trigger: w.trigger,
      schedule: w.schedule,
      graph: w.graph,
      lastRunAt: w.lastRunAt ? w.lastRunAt.toISOString() : null,
      lastRunStatus: w.lastRunStatus,
      recentRuns: (await listRuns(service, w.id, 25)).map((r) => ({
        id: r.id,
        status: r.status,
        summary: r.summary,
        conversationId: r.conversationId,
        trigger: r.trigger,
        nodeRuns: r.nodeRuns,
        createdAt: r.createdAt.toISOString(),
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      })),
    })),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Automations</h1>
        <p className="text-sm text-muted">
          Build workflows as a node graph - triggers, AI agents with their own tools, conditions, and
          deterministic actions. Run on demand or on a schedule, and review exactly what each run did.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <AutomationsManager initial={withRuns} />
      </div>
    </div>
  );
}
