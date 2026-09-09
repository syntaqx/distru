"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  addProductImage,
  archiveProduct,
  deleteProductImage,
  getProduct,
  setPrimaryProductImage,
  upsertProduct,
} from "@/lib/modules/catalog";
import {
  findOrCreateBrand,
  findOrCreateCategory,
  findOrCreateCompany,
  getDefaultLocation,
} from "@/lib/modules/catalog";
import { getOnHand, setOnHand } from "@/lib/modules/inventory";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

export type ProductForm = {
  id?: string;
  name: string;
  sku: string;
  upc?: string;
  status?: "ACTIVE" | "ARCHIVED";
  trackingMethod?: "PACKAGE" | "PRODUCT" | "BATCH";
  // Reference data created on the fly by name.
  category?: string;
  vendor?: string;
  brand?: string;
  // Reference data selected by id (from existing rows), "" to clear.
  subcategoryId?: string;
  strainId?: string;
  productGroupId?: string;
  unitTypeId?: string;
  // Numbers.
  unitPrice?: number | null;
  msrp?: number | null;
  netQuantityPerUnit?: number | null;
  servingSize?: number | null;
  thcContent?: number | null;
  cbdContent?: number | null;
  // Flags.
  isInventoryItem?: boolean;
  isSample?: boolean;
  taxable?: boolean;
  description?: string;
  onHand?: number | null;
};

/** "" -> null (clear the reference), otherwise the id. */
const idOrNull = (v: string | undefined) => (v ? v : null);

export async function saveProductAction(
  form: ProductForm,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const service = await svc();
  if (!form.name?.trim() || !form.sku?.trim())
    return { ok: false, error: "Name and SKU are required." };

  const category = form.category?.trim() ? await findOrCreateCategory(service, form.category) : null;
  const vendor = form.vendor?.trim() ? await findOrCreateCompany(service, form.vendor) : null;
  const brand = form.brand?.trim() ? await findOrCreateBrand(service, form.brand) : null;

  try {
    const { product } = await upsertProduct(service, {
      id: form.id,
      name: form.name,
      sku: form.sku,
      upc: form.upc ?? null,
      status: form.status,
      inventoryTrackingMethod: form.trackingMethod,
      categoryId: category ? category.id : form.category === "" ? null : undefined,
      vendorId: vendor ? vendor.id : form.vendor === "" ? null : undefined,
      brandId: brand ? brand.id : form.brand === "" ? null : undefined,
      subcategoryId: idOrNull(form.subcategoryId),
      strainId: idOrNull(form.strainId),
      productGroupId: idOrNull(form.productGroupId),
      unitTypeId: idOrNull(form.unitTypeId),
      unitPrice: form.unitPrice ?? null,
      msrp: form.msrp ?? null,
      netQuantityPerUnit: form.netQuantityPerUnit ?? null,
      servingSize: form.servingSize ?? null,
      thcContent: form.thcContent ?? null,
      cbdContent: form.cbdContent ?? null,
      isInventoryItem: form.isInventoryItem,
      isSample: form.isSample,
      taxable: form.taxable,
      description: form.description ?? null,
    });

    if (form.onHand != null && Number.isFinite(form.onHand)) {
      const loc = await getDefaultLocation(service);
      const current = await getOnHand(service, product.product.id, loc.id);
      if (current !== form.onHand) {
        await setOnHand(service, {
          productId: product.product.id,
          locationId: loc.id,
          target: form.onHand,
          reason: "manual edit",
        });
      }
    }
    revalidatePath("/inventory");
    revalidatePath(`/inventory/${product.product.id}`);
    return { ok: true, id: product.product.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function addProductImageAction(
  productId: string,
  dataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await addProductImage(service, productId, dataUrl);
    revalidatePath(`/inventory/${productId}`);
    revalidatePath(`/inventory/${productId}/edit`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add image." };
  }
}

export async function deleteProductImageAction(
  imageId: string,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await deleteProductImage(service, imageId);
    revalidatePath(`/inventory/${productId}`);
    revalidatePath(`/inventory/${productId}/edit`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete image." };
  }
}

export async function setPrimaryImageAction(
  imageId: string,
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await setPrimaryProductImage(service, imageId);
    revalidatePath(`/inventory/${productId}`);
    revalidatePath(`/inventory/${productId}/edit`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not set primary image." };
  }
}

export async function archiveProductAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    await archiveProduct(service, id);
    revalidatePath("/inventory");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not archive product." };
  }
}

export async function restoreProductAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const service = await svc();
  try {
    const p = await getProduct(service, id);
    if (p) await upsertProduct(service, { id, status: "ACTIVE" });
    revalidatePath("/inventory");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not restore product." };
  }
}
