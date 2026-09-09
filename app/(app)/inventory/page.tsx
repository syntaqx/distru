import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";
import { listCategories, listCompanies, listUnitTypes } from "@/lib/modules/catalog";
import { InventoryManager, type Row } from "@/components/inventory/inventory-manager";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { q } = await searchParams;

  const [{ items }, onHand, cats, vendors, units] = await Promise.all([
    listProducts(service, { limit: 500 }),
    onHandByProduct(service),
    listCategories(service),
    listCompanies(service),
    listUnitTypes(),
  ]);

  const rows: Row[] = items.map((p) => ({
    id: p.product.id,
    name: p.product.name,
    sku: p.product.sku,
    category: p.category?.name ?? null,
    vendor: p.vendor?.name ?? null,
    unitType: p.unitType?.name ?? null,
    unitPrice: p.product.unitPrice,
    trackingMethod: p.product.inventoryTrackingMethod,
    status: p.product.status,
    onHand: onHand.get(p.product.id) ?? 0,
    imageUrl: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.dataUrl ?? null,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">
          Manage your catalog by hand, or ask the Copilot - both write the same records.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <InventoryManager
          rows={rows}
          categories={cats.map((c) => c.name)}
          vendors={vendors.map((v) => v.name)}
          unitTypes={units.map((u) => u.name)}
          initialQuery={q ?? ""}
        />
      </div>
    </div>
  );
}
