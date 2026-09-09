import { getOrgContext } from "@/lib/session";
import { listBins } from "@/lib/modules/inventory";
import { listLocations } from "@/lib/modules/catalog";
import { BinsManager, type BinRowView } from "@/components/inventory/bins-manager";

export const dynamic = "force-dynamic";

export default async function BinsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items }, locations] = await Promise.all([
    listBins(service, { limit: 200 }),
    listLocations(service),
  ]);

  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const bins: BinRowView[] = items.map((b) => ({
    id: b.id,
    name: b.name,
    location: b.locationId ? locationName.get(b.locationId) ?? null : null,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">
          Storage bins - the finest-grained stock positions within a location.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <BinsManager bins={bins} />
      </div>
    </div>
  );
}
