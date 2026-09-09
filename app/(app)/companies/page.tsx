import { getOrgContext } from "@/lib/session";
import { listCompanies } from "@/lib/modules/catalog";
import { CompaniesManager } from "@/components/companies/companies-manager";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const companies = await listCompanies(service);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Companies</h1>
        <p className="text-sm text-muted">
          Your CRM - customers, vendors, distributors, and brands. Add them here or import a list from the Copilot.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <CompaniesManager
          rows={companies.map((c) => ({ id: c.id, name: c.name, roles: c.roles }))}
        />
      </div>
    </div>
  );
}
