import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getProduct, getDefaultLocation } from "@/lib/modules/catalog";
import { getOnHand } from "@/lib/modules/inventory";
import { ProductForm } from "@/components/inventory/product-form";
import { loadProductFormOptions } from "../../_options";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const p = await getProduct(service, id);
  if (!p) notFound();

  const [options, loc] = await Promise.all([loadProductFormOptions(service), getDefaultLocation(service)]);
  const onHand = await getOnHand(service, id, loc.id);
  const n = (v: string | null) => (v == null ? null : Number(v));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <ProductForm
          initial={{
            id: p.product.id,
            name: p.product.name,
            sku: p.product.sku,
            upc: p.product.upc ?? "",
            status: p.product.status as "ACTIVE" | "ARCHIVED",
            trackingMethod: p.product.inventoryTrackingMethod,
            category: p.category?.name ?? "",
            vendor: p.vendor?.name ?? "",
            brand: p.brand?.name ?? "",
            subcategoryId: p.subcategory?.id ?? "",
            strainId: p.strain?.id ?? "",
            productGroupId: p.productGroup?.id ?? "",
            unitTypeId: p.unitType?.id ?? "",
            unitPrice: n(p.product.unitPrice),
            msrp: n(p.product.msrp),
            netQuantityPerUnit: n(p.product.netQuantityPerUnit),
            servingSize: n(p.product.servingSize),
            thcContent: n(p.product.thcContent),
            cbdContent: n(p.product.cbdContent),
            isInventoryItem: p.product.isInventoryItem,
            isSample: p.product.isSample,
            taxable: p.product.taxable,
            description: p.product.description ?? "",
            onHand,
          }}
          images={p.images.map((img) => ({ id: img.id, url: img.dataUrl, isPrimary: img.isPrimary }))}
          {...options}
        />
      </div>
    </div>
  );
}
