import { getOrgContext } from "@/lib/session";
import { listProducts, listCompanies } from "@/lib/modules/catalog";
import { PoForm, type PoProductOption } from "@/components/purchasing/po-form";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items: products }, companies] = await Promise.all([
    listProducts(service, { status: "ACTIVE", limit: 500 }),
    listCompanies(service),
  ]);

  const productOptions: PoProductOption[] = products.map((p) => ({
    sku: p.product.sku,
    name: p.product.name,
  }));

  const vendors = companies
    .filter((c) => c.roles.includes("VENDOR"))
    .map((c) => c.name);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <PoForm products={productOptions} vendors={vendors} />
      </div>
    </div>
  );
}
