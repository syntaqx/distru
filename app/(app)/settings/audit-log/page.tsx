import { getOrgContext } from "@/lib/session";
import { listRecentAudit } from "@/lib/modules/shared";
import { AuditLogView, type AuditEntry } from "@/components/settings/audit-log-view";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const rows = await listRecentAudit(service, 200);

  const entries: AuditEntry[] = rows.map((r) => {
    const after = r.after as { name?: string; sku?: string; title?: string } | null;
    return {
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorType: r.actorType,
      actorId: r.actorId,
      label: after?.name ?? after?.title ?? after?.sku ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">Audit log</h1>
          <p className="text-sm text-muted">
            An append-only record of changes across your workspace - who did what,
            and when.
          </p>
        </header>

        <AuditLogView entries={entries} />
      </div>
    </div>
  );
}
