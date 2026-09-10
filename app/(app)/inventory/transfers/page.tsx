import { getOrgContext } from "@/lib/session";
import { listTransfers, getTransfer } from "@/lib/modules/inventory";
import { listLocations } from "@/lib/modules/catalog";
import {
  TransfersManager,
  type TransferRowView,
} from "@/components/inventory/transfers-manager";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items }, locations] = await Promise.all([
    listTransfers(service, { limit: 200 }),
    listLocations(service),
  ]);

  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  // The list query returns transfer headers only; hydrate their lines so we can
  // show line counts and the total cost moved.
  const full = await Promise.all(items.map((t) => getTransfer(service, t.id)));

  const hydrated = full.filter((t): t is NonNullable<typeof t> => t !== null);
  const totalMovedCost = hydrated.reduce(
    (a, t) => a + t.lines.reduce((s, l) => s + Number(l.movedCost), 0),
    0,
  );
  const transfers: TransferRowView[] = hydrated.map((t) => ({
    id: t.id,
    transferNumber: t.transferNumber,
    fromLocation: t.fromLocationId ? locationName.get(t.fromLocationId) ?? null : null,
    toLocation: t.toLocationId ? locationName.get(t.toLocationId) ?? null : null,
    lineCount: t.lines.length,
    status: t.status,
    createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "-",
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">
          Auditable, cost-preserving stock moves between locations.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <TransfersManager transfers={transfers} totalMovedCost={totalMovedCost} />
      </div>
    </div>
  );
}
