import { getOrgContext } from "@/lib/session";
import { listProducts, listCompanies } from "@/lib/modules/catalog";
import { listOrders } from "@/lib/modules/sales";
import { ReturnForm } from "@/components/sales/return-form";
import { SalesSubnav } from "@/components/sales/sales-subnav";
import type { ProductOption } from "@/components/sales/sales-manager";

export const dynamic = "force-dynamic";

export default async function NewReturnPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items: products }, companies, { items: orders }] = await Promise.all([
    listProducts(service, { status: "ACTIVE", limit: 500 }),
    listCompanies(service),
    listOrders(service, { limit: 200 }),
  ]);

  const productOptions: ProductOption[] = products.map((p) => ({
    sku: p.product.sku,
    name: p.product.name,
    unitPrice: p.product.unitPrice ? Number(p.product.unitPrice) : 0,
  }));

  const customers = companies
    .filter((c) => c.roles.includes("CUSTOMER"))
    .map((c) => c.name);

  const orderNumbers = orders.map((o) => o.order.orderNumber);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <SalesSubnav />
        <ReturnForm
          products={productOptions}
          customers={customers}
          orderNumbers={orderNumbers}
        />
      </div>
    </div>
  );
}
