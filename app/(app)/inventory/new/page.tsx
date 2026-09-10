import { getOrgContext } from "@/lib/session";
import { ProductForm } from "@/components/inventory/product-form";
import { loadProductFormOptions } from "../_options";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const options = await loadProductFormOptions(service);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <ProductForm
          initial={{ name: "", sku: "", status: "ACTIVE", trackingMethod: "PACKAGE", isInventoryItem: true, taxable: true, isSample: false }}
          {...options}
        />
      </div>
    </div>
  );
}
