import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { listStrains, listLocations } from "@/lib/modules/catalog";
import { getPlantBatch } from "@/lib/modules/cultivation";
import { PlantBatchForm } from "@/components/cultivation/plant-batch-form";

export const dynamic = "force-dynamic";

export default async function EditPlantBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const [batch, { items: strains }, locations] = await Promise.all([
    getPlantBatch(service, id),
    listStrains(service, { limit: 500 }),
    listLocations(service),
  ]);
  if (!batch) notFound();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <PlantBatchForm
          strains={strains.map((s) => ({ id: s.id, name: s.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          initial={{
            id: batch.id,
            batchNumber: batch.batchNumber,
            strainId: batch.strainId,
            locationId: batch.locationId,
            count: batch.count,
            phase: batch.phase,
            sourceType: batch.sourceType,
          }}
        />
      </div>
    </div>
  );
}
