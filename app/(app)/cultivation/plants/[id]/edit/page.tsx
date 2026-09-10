import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { listStrains, listLocations } from "@/lib/modules/catalog";
import { getPlant } from "@/lib/modules/cultivation";
import { PlantForm } from "@/components/cultivation/plant-form";

export const dynamic = "force-dynamic";

export default async function EditPlantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const [plant, { items: strains }, locations] = await Promise.all([
    getPlant(service, id),
    listStrains(service, { limit: 500 }),
    listLocations(service),
  ]);
  if (!plant) notFound();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <PlantForm
          strains={strains.map((s) => ({ id: s.id, name: s.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          initial={{
            id: plant.id,
            plantTag: plant.plantTag,
            strainId: plant.strainId,
            locationId: plant.locationId,
            phase: plant.phase,
          }}
        />
      </div>
    </div>
  );
}
