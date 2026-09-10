import { getOrgContext } from "@/lib/session";
import { listProducts, listLocations } from "@/lib/modules/catalog";
import {
  TransferForm,
  type ProductOption,
} from "@/components/inventory/transfer-form";

export const dynamic = "force-dynamic";

export default async function NewTransferPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items: products }, locations] = await Promise.all([
    listProducts(service, { status: "ACTIVE", limit: 500 }),
    listLocations(service),
  ]);

  const productOptions: ProductOption[] = products.map((p) => ({
    id: p.product.id,
    name: p.product.name,
    sku: p.product.sku,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <TransferForm
          products={productOptions}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
