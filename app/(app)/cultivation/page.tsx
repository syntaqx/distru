import { getOrgContext } from "@/lib/session";
import { listStrains, listLocations } from "@/lib/modules/catalog";
import { listHarvests, listPlantBatches, listPlants } from "@/lib/modules/cultivation";
import {
  CultivationManager,
  type HarvestRow,
  type PlantBatchRow,
  type PlantRow,
} from "@/components/cultivation/cultivation-manager";

export const dynamic = "force-dynamic";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export default async function CultivationPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items: batches }, { items: plants }, { items: harvests }, { items: strains }, locations] =
    await Promise.all([
      listPlantBatches(service, { limit: 200 }),
      listPlants(service, { limit: 200 }),
      listHarvests(service, { limit: 200 }),
      listStrains(service, { limit: 500 }),
      listLocations(service),
    ]);

  const strainName = new Map(strains.map((s) => [s.id, s.name]));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const batchRows: PlantBatchRow[] = batches.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    strainName: b.strainId ? strainName.get(b.strainId) ?? null : null,
    locationName: b.locationId ? locationName.get(b.locationId) ?? null : null,
    count: b.count,
    phase: b.phase,
    plantedDate: iso(b.plantedDate),
  }));

  const plantRows: PlantRow[] = plants.map((p) => ({
    id: p.id,
    plantTag: p.plantTag,
    strainName: p.strainId ? strainName.get(p.strainId) ?? null : null,
    locationName: p.locationId ? locationName.get(p.locationId) ?? null : null,
    phase: p.phase,
    plantedDate: iso(p.plantedDate),
  }));

  const harvestRows: HarvestRow[] = harvests.map((h) => ({
    id: h.id,
    harvestNumber: h.harvestNumber,
    name: h.name ?? null,
    strainName: h.strainId ? strainName.get(h.strainId) ?? null : null,
    plantCount: h.plantCount,
    wetWeight: h.wetWeight != null ? Number(h.wetWeight) : null,
    dryWeight: h.dryWeight != null ? Number(h.dryWeight) : null,
    status: h.status,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Cultivation</h1>
        <p className="text-sm text-muted">
          Track plant batches through their lifecycle, individual plants, and the
          harvests they yield.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <CultivationManager
          plantBatches={batchRows}
          plants={plantRows}
          harvests={harvestRows}
        />
      </div>
    </div>
  );
}
