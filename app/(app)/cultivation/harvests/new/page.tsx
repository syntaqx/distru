import { getOrgContext } from "@/lib/session";
import { listStrains } from "@/lib/modules/catalog";
import { HarvestForm } from "@/components/cultivation/harvest-form";

export const dynamic = "force-dynamic";

export default async function NewHarvestPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const { items: strains } = await listStrains(service, { limit: 500 });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <HarvestForm strains={strains.map((s) => ({ id: s.id, name: s.name }))} />
      </div>
    </div>
  );
}
