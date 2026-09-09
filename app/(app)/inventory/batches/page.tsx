import { getOrgContext } from "@/lib/session";
import { listBatches } from "@/lib/modules/inventory";
import { listProducts } from "@/lib/modules/catalog";
import {
  BatchesManager,
  type BatchRowView,
} from "@/components/inventory/batches-manager";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items }, { items: products }] = await Promise.all([
    listBatches(service, { limit: 200 }),
    listProducts(service, { limit: 500 }),
  ]);

  const productName = new Map(products.map((p) => [p.product.id, p.product.name]));

  const batches: BatchRowView[] = items.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    product: b.productId ? productName.get(b.productId) ?? null : null,
    createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">
          Production and harvest batches - the lots that packages derive from.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <BatchesManager batches={batches} />
      </div>
    </div>
  );
}
