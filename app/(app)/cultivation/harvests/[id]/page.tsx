import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { listProducts, listStrains, listLocations } from "@/lib/modules/catalog";
import { getHarvest } from "@/lib/modules/cultivation";
import { HarvestDetail } from "@/components/cultivation/harvest-detail";

export const dynamic = "force-dynamic";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export default async function HarvestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const harvest = await getHarvest(service, id);
  if (!harvest) notFound();

  const [{ items: products }, { items: strains }, locations] = await Promise.all([
    listProducts(service, { limit: 200 }),
    listStrains(service, { limit: 500 }),
    listLocations(service),
  ]);

  const strainName = new Map(strains.map((s) => [s.id, s.name]));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <HarvestDetail
          harvest={{
            id: harvest.id,
            harvestNumber: harvest.harvestNumber,
            name: harvest.name ?? null,
            strainName: harvest.strainId ? strainName.get(harvest.strainId) ?? null : null,
            locationName: harvest.locationId ? locationName.get(harvest.locationId) ?? null : null,
            plantCount: harvest.plantCount,
            wetWeight: harvest.wetWeight != null ? Number(harvest.wetWeight) : null,
            dryWeight: harvest.dryWeight != null ? Number(harvest.dryWeight) : null,
            status: harvest.status,
            harvestedDate: iso(harvest.harvestedDate),
          }}
          products={products.map((p) => ({ id: p.product.id, name: p.product.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
