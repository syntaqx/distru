import { getOrgContext } from "@/lib/session";
import { listPurchaseOrders } from "@/lib/modules/purchasing";
import {
  PurchasingManager,
  type PoRow,
} from "@/components/purchasing/purchasing-manager";

export const dynamic = "force-dynamic";

export default async function PurchasingPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const { items } = await listPurchaseOrders(service, { limit: 200 });

  const orders: PoRow[] = items.map((r) => ({
    poNumber: r.purchaseOrder.poNumber,
    status: r.purchaseOrder.status,
    vendor: r.vendor?.name ?? null,
    itemCount: r.itemCount,
    total: r.total,
    orderDate: r.purchaseOrder.orderDate.toISOString(),
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Purchasing</h1>
        <p className="text-sm text-muted">
          Purchase orders to your vendors. Create them by hand, or ask the
          Copilot - receiving a PO increments inventory.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <PurchasingManager orders={orders} />
      </div>
    </div>
  );
}
