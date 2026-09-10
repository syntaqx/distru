import { getOrgContext } from "@/lib/session";
import { listProducts, listCompanies } from "@/lib/modules/catalog";
import { OrderForm } from "@/components/sales/order-form";
import type { ProductOption } from "@/components/sales/sales-manager";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
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

  const productOptions: ProductOption[] = products.map((p) => ({
    sku: p.product.sku,
    name: p.product.name,
    unitPrice: p.product.unitPrice ? Number(p.product.unitPrice) : 0,
  }));

  const customers = companies
    .filter((c) => c.roles.includes("CUSTOMER"))
    .map((c) => c.name);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <OrderForm products={productOptions} customers={customers} />
      </div>
    </div>
  );
}
