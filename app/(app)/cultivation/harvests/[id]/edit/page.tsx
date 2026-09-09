import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { listStrains } from "@/lib/modules/catalog";
import { getHarvest } from "@/lib/modules/cultivation";
import { HarvestForm } from "@/components/cultivation/harvest-form";

export const dynamic = "force-dynamic";

export default async function EditHarvestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const [harvest, { items: strains }] = await Promise.all([
    getHarvest(service, id),
    listStrains(service, { limit: 500 }),
  ]);
  if (!harvest) notFound();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <HarvestForm
          strains={strains.map((s) => ({ id: s.id, name: s.name }))}
          initial={{
            id: harvest.id,
            name: harvest.name,
            strainId: harvest.strainId,
            plantCount: harvest.plantCount,
            wetWeight: harvest.wetWeight != null ? Number(harvest.wetWeight) : null,
            dryWeight: harvest.dryWeight != null ? Number(harvest.dryWeight) : null,
            status: harvest.status,
          }}
        />
      </div>
    </div>
  );
}
