import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/modules/catalog";
import { BatchForm } from "@/components/inventory/batch-form";

export const dynamic = "force-dynamic";

export default async function NewBatchPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const { items: products } = await listProducts(service, { limit: 500 });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <BatchForm
          initial={{ batchNumber: "", productId: "" }}
          products={products.map((p) => ({ id: p.product.id, name: p.product.name }))}
        />
      </div>
    </div>
  );
}
