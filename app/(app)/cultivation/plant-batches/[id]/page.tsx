import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { listStrains, listLocations } from "@/lib/modules/catalog";
import {
  getPlantBatch,
  listPlantEvents,
  listPlants,
} from "@/lib/modules/cultivation";
import { PlantBatchDetail } from "@/components/cultivation/plant-batch-detail";

export const dynamic = "force-dynamic";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export default async function PlantBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const batch = await getPlantBatch(service, id);
  if (!batch) notFound();

  const [{ items: plants }, { items: events }, { items: strains }, locations] = await Promise.all([
    listPlants(service, { limit: 200 }),
    listPlantEvents(service, { plantBatchId: id, limit: 100 }),
    listStrains(service, { limit: 500 }),
    listLocations(service),
  ]);

  const strainName = new Map(strains.map((s) => [s.id, s.name]));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <PlantBatchDetail
          batch={{
            id: batch.id,
            batchNumber: batch.batchNumber,
            strainName: batch.strainId ? strainName.get(batch.strainId) ?? null : null,
            locationName: batch.locationId ? locationName.get(batch.locationId) ?? null : null,
            count: batch.count,
            phase: batch.phase,
            sourceType: batch.sourceType ?? null,
            plantedDate: iso(batch.plantedDate),
          }}
          plants={plants
            .filter((p) => p.plantBatchId === id)
            .map((p) => ({ id: p.id, plantTag: p.plantTag, phase: p.phase }))}
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
