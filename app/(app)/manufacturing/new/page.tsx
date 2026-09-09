import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/modules/catalog";
import { nextAssemblyNumber } from "@/lib/modules/manufacturing";
import {
  AssemblyForm,
  type ProductOption,
} from "@/components/manufacturing/assembly-form";

export const dynamic = "force-dynamic";

export default async function NewAssemblyPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items: products }, assemblyNumber] = await Promise.all([
    listProducts(service, { status: "ACTIVE", limit: 200 }),
    nextAssemblyNumber(service),
  ]);

  const productOptions: ProductOption[] = products.map((p) => ({
    id: p.product.id,
    sku: p.product.sku,
    name: p.product.name,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <AssemblyForm products={productOptions} assemblyNumber={assemblyNumber} />
      </div>
    </div>
  );
}
