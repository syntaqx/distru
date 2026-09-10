import { getOrgContext } from "@/lib/session";
import {
  getFleetTelemetry,
  listDeliveries,
  listDriverDirectory,
  listVehicles,
  orderIdsWithDeliveries,
} from "@/lib/modules/logistics";
import { listOrders } from "@/lib/modules/sales";
import { FleetManager } from "@/components/fleet/fleet-manager";

export const dynamic = "force-dynamic";

/** Orders eligible to have a delivery created for them (active, not yet routed). */
const DELIVERABLE_STATUSES = new Set(["PROCESSING", "READY_TO_SHIP", "DELIVERING"]);

export default async function FleetPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const [drivers, vehicles, deliveries, orders, telemetry] = await Promise.all([
    listDriverDirectory(service),
    listVehicles(service, { limit: 200 }),
    listDeliveries(service, { limit: 200 }),
    listOrders(service, { limit: 200 }),
    getFleetTelemetry(service),
  ]);

  const candidateOrders = orders.items.filter((o) => DELIVERABLE_STATUSES.has(o.order.status));
  const withDeliveries = await orderIdsWithDeliveries(
    service,
    candidateOrders.map((o) => o.order.id),
  );
  const assignableOrders = candidateOrders
    .filter((o) => !withDeliveries.has(o.order.id))
    .map((o) => ({
      id: o.order.id,
      orderNumber: o.order.orderNumber,
      customerName: o.customer?.name ?? null,
      status: o.order.status,
    }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Fleet</h1>
        <p className="text-sm text-muted">
          Live dispatch map, deliveries, drivers, and vehicles.
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <FleetManager
          drivers={drivers.map((d) => ({
            id: d.id,
            name: d.name,
            phone: d.phone,
            licenseNumber: d.licenseNumber,
            memberId: d.memberId,
          }))}
          vehicles={vehicles.items.map((v) => ({
            id: v.id,
            name: v.name,
            make: v.make,
            model: v.model,
            licensePlate: v.licensePlate,
          }))}
          deliveries={deliveries.items.map((d) => ({
            id: d.delivery.id,
            status: d.delivery.status,
            orderId: d.delivery.orderId,
            orderNumber: d.orderNumber,
            customerName: d.customer?.name ?? null,
            driverId: d.driver?.id ?? null,
            driverName: d.driver?.name ?? null,
            vehicleName: d.vehicle?.name ?? null,
            sequence: d.delivery.sequence,
            scheduledAt: d.delivery.scheduledAt ? d.delivery.scheduledAt.toISOString() : null,
            deliveredAt: d.delivery.deliveredAt ? d.delivery.deliveredAt.toISOString() : null,
            address: formatAddress(d.delivery.address),
            notes: d.delivery.notes,
          }))}
          assignableOrders={assignableOrders}
          telemetry={telemetry}
        />
      </div>
    </div>
  );
}

/** Collapse an address snapshot object into a one-line label for the board. */
function formatAddress(address: unknown): string | null {
  if (!address || typeof address !== "object") return null;
  const a = address as Record<string, string | null | undefined>;
  const parts = [a.line1, a.line2, a.city, a.state, a.postal_code].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  return parts.length ? parts.join(", ") : null;
}
