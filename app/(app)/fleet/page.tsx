import { getOrgContext } from "@/lib/session";
import { listDrivers, listVehicles } from "@/lib/modules/logistics";
import { FleetManager } from "@/components/fleet/fleet-manager";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const [drivers, vehicles] = await Promise.all([
    listDrivers(service, { limit: 200 }),
    listVehicles(service, { limit: 200 }),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Fleet</h1>
        <p className="text-sm text-muted">
          The drivers and vehicles that fulfill your deliveries.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <FleetManager
          drivers={drivers.items.map((d) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            licenseNumber: d.licenseNumber,
          }))}
          vehicles={vehicles.items.map((v) => ({
            id: v.id,
            name: v.name,
            make: v.make,
            model: v.model,
            licensePlate: v.licensePlate,
          }))}
        />
      </div>
    </div>
  );
}
