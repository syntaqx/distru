import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getPackage } from "@/lib/modules/inventory";
import { listProducts, listLocations } from "@/lib/modules/catalog";
import { PackageForm } from "@/components/inventory/package-form";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const pkg = await getPackage(service, id);
  if (!pkg) notFound();

  const [{ items: products }, locations] = await Promise.all([
    listProducts(service, { limit: 500 }),
    listLocations(service),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <PackageForm
          initial={{
            id: pkg.id,
            packageTag: pkg.packageTag,
            productId: pkg.productId ?? "",
            locationId: pkg.locationId ?? "",
            quantity: String(Number(pkg.quantity)),
            status: pkg.status,
          }}
          products={products.map((p) => ({ id: p.product.id, name: p.product.name }))}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
