import { getOrgContext } from "@/lib/session";
import { listStrains, listLocations } from "@/lib/modules/catalog";
import { PlantBatchForm } from "@/components/cultivation/plant-batch-form";

export const dynamic = "force-dynamic";

export default async function NewPlantBatchPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items: strains }, locations] = await Promise.all([
    listStrains(service, { limit: 500 }),
    listLocations(service),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <PlantBatchForm
          strains={strains.map((s) => ({ id: s.id, name: s.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
