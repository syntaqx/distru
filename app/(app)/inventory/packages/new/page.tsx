import { getOrgContext } from "@/lib/session";
import { listProducts, listLocations } from "@/lib/modules/catalog";
import { PackageForm } from "@/components/inventory/package-form";

export const dynamic = "force-dynamic";

export default async function NewPackagePage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items: products }, locations] = await Promise.all([
    listProducts(service, { limit: 500 }),
    listLocations(service),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <PackageForm
          initial={{
            packageTag: "",
            productId: "",
            locationId: "",
            quantity: "",
            status: "ACTIVE",
          }}
          products={products.map((p) => ({ id: p.product.id, name: p.product.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
