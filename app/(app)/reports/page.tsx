import { getOrgContext } from "@/lib/session";
import { listArtifacts } from "@/lib/modules/reports";
import { ReportsView, type ReportLite } from "@/components/reports/reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const rows = await listArtifacts(service, { limit: 100 });
  const reports: ReportLite[] = rows.map((a) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    format: a.format,
    createdBy: a.createdBy,
    deliveries: a.deliveries,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Reports</h1>
        <p className="text-sm text-muted">
          Durable outputs your automations and the Copilot produce - view them here, download them, or
          have a workflow email them and upload them to Drive.
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <ReportsView initial={reports} />
      </div>
    </div>
  );
}
