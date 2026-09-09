import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getCompany, listCompanyGroups } from "@/lib/modules/catalog";
import { CompanyForm } from "@/components/companies/company-form";

export const dynamic = "force-dynamic";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const c = await getCompany(service, id);
  if (!c) notFound();

  const groups = await listCompanyGroups(service);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <CompanyForm
          initial={{
            id: c.id,
            name: c.name,
            roles: c.roles,
            groupId: c.groupId ?? "",
            tags: c.tags ?? [],
          }}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        />
      </div>
    </div>
  );
}
