import { getOrgContext } from "@/lib/session";
import { listPackages } from "@/lib/modules/inventory";
import { listProducts, listLocations } from "@/lib/modules/catalog";
import {
  PackagesManager,
  type PackageRowView,
} from "@/components/inventory/packages-manager";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items }, { items: products }, locations] = await Promise.all([
    listPackages(service, { limit: 200 }),
    listProducts(service, { limit: 500 }),
    listLocations(service),
  ]);

  const productName = new Map(products.map((p) => [p.product.id, p.product.name]));
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const packages: PackageRowView[] = items.map((p) => ({
    id: p.id,
    packageTag: p.packageTag,
    product: p.productId ? productName.get(p.productId) ?? null : null,
    quantity: Number(p.quantity),
    location: p.locationId ? locationName.get(p.locationId) ?? null : null,
    status: p.status,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">
          Tagged, Metrc-style packages - the lot-level counterpart to on-hand
          stock.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <PackagesManager packages={packages} />
      </div>
    </div>
  );
}
