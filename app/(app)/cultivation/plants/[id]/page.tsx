import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { listStrains, listLocations } from "@/lib/modules/catalog";
import { getPlant, getPlantBatch, listPlantEvents } from "@/lib/modules/cultivation";
import { PlantDetail } from "@/components/cultivation/plant-detail";

export const dynamic = "force-dynamic";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export default async function PlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const plant = await getPlant(service, id);
  if (!plant) notFound();

  const [{ items: events }, { items: strains }, locations, batch] = await Promise.all([
    listPlantEvents(service, { plantId: id, limit: 100 }),
    listStrains(service, { limit: 500 }),
    listLocations(service),
    plant.plantBatchId ? getPlantBatch(service, plant.plantBatchId) : Promise.resolve(null),
  ]);

  const strainName = new Map(strains.map((s) => [s.id, s.name]));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <PlantDetail
          plant={{
            id: plant.id,
            plantTag: plant.plantTag,
            strainName: plant.strainId ? strainName.get(plant.strainId) ?? null : null,
            locationName: plant.locationId ? locationName.get(plant.locationId) ?? null : null,
            phase: plant.phase,
            batchId: plant.plantBatchId ?? null,
            batchNumber: batch?.batchNumber ?? null,
            plantedDate: iso(plant.plantedDate),
          }}
          events={events.map((e) => ({
            id: e.id,
            type: e.type,
            note: e.note,
            occurredAt: iso(e.occurredAt),
          }))}
        />
      </div>
    </div>
  );
}
