import { getOrgContext } from "@/lib/session";
import { listCompanyGroups } from "@/lib/modules/catalog";
import { CompanyForm } from "@/components/companies/company-form";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const groups = await listCompanyGroups(service);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <CompanyForm
          initial={{ name: "", roles: ["CUSTOMER"], groupId: "", tags: [] }}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        />
      </div>
    </div>
  );
}
