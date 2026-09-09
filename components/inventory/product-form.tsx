"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImagePlus, Star, Trash2, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  addProductImageAction,
  deleteProductImageAction,
  saveProductAction,
  setPrimaryImageAction,
  type ProductForm as ProductFormData,
} from "@/app/(app)/inventory/actions";

export type Option = { id: string; name: string };
export type ProductImage = { id: string; url: string; isPrimary: boolean };
export type ProductFormValues = ProductFormData & { images?: ProductImage[] };

export function ProductForm({
  initial,
  categories,
  vendors,
  brands,
  strains,
  subcategories,
  groups,
  unitTypes,
  images = [],
}: {
  initial: ProductFormValues;
  categories: string[];
  vendors: string[];
  brands: string[];
  strains: Option[];
  subcategories: Option[];
  groups: Option[];
  unitTypes: Option[];
  images?: ProductImage[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<ProductFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const numField = (v: string) => (v === "" ? null : Number(v));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveProductAction(form);
      if (res.ok && res.id) router.push(`/inventory/${res.id}`);
      else setError(res.error ?? "Could not save product.");
    });
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !initial.id) return;
    if (file.size > 2_000_000) {
      setError("Image too large (max 2MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setUploading(true);
      startTransition(async () => {
        const res = await addProductImageAction(initial.id!, dataUrl);
        setUploading(false);
        if (res.ok) router.refresh();
        else setError(res.error ?? "Could not add image.");
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const imageAction = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });

  const label = "mb-1 block text-xs font-medium text-muted";
  const field = "mb-3";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.name || "product"}` : "New product"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit ? initial.sku : "Add a product to your catalog."}
          </p>
        </div>
        <Link
          href={isEdit ? `/inventory/${initial.id}` : "/inventory"}
          className="btn btn-ghost"
        >
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Identity</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={label}>Name</label>
                <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </div>
              <div>
                <label className={label}>SKU</label>
                <input className="input" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
              </div>
              <div>
                <label className={label}>UPC / barcode</label>
                <input className="input" value={form.upc ?? ""} onChange={(e) => set("upc", e.target.value)} />
              </div>
              <div>
                <label className={label}>Category</label>
                <Combobox
                  ariaLabel="Category"
                  value={form.category ?? ""}
                  onValueChange={(v) => set("category", v)}
                  placeholder="Search or add a category…"
                  options={categories.map((c) => ({ value: c, label: c }))}
                />
              </div>
              <div>
                <label className={label}>Subcategory</label>
                <Select
                  ariaLabel="Subcategory"
                  value={form.subcategoryId ?? ""}
                  onValueChange={(v) => set("subcategoryId", v)}
                  placeholder="None"
                  options={[{ value: "", label: "None" }, ...subcategories.map((s) => ({ value: s.id, label: s.name }))]}
                />
              </div>
              <div>
                <label className={label}>Vendor</label>
                <Combobox
                  ariaLabel="Vendor"
                  value={form.vendor ?? ""}
                  onValueChange={(v) => set("vendor", v)}
                  placeholder="Search or add a vendor…"
                  options={vendors.map((v) => ({ value: v, label: v }))}
                />
              </div>
              <div>
                <label className={label}>Brand</label>
                <Combobox
                  ariaLabel="Brand"
                  value={form.brand ?? ""}
                  onValueChange={(v) => set("brand", v)}
                  placeholder="Search or add a brand…"
                  options={brands.map((b) => ({ value: b, label: b }))}
                />
              </div>
              <div>
                <label className={label}>Strain</label>
                <Select
                  ariaLabel="Strain"
                  value={form.strainId ?? ""}
                  onValueChange={(v) => set("strainId", v)}
                  placeholder="None"
                  options={[{ value: "", label: "None" }, ...strains.map((s) => ({ value: s.id, label: s.name }))]}
                />
              </div>
              <div>
                <label className={label}>Product group</label>
                <Select
                  ariaLabel="Product group"
                  value={form.productGroupId ?? ""}
                  onValueChange={(v) => set("productGroupId", v)}
                  placeholder="None"
                  options={[{ value: "", label: "None" }, ...groups.map((g) => ({ value: g.id, label: g.name }))]}
                />
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Pricing & measurement</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className={label}>Unit price</label>
                <input className="input" type="number" step="0.01" value={form.unitPrice ?? ""} onChange={(e) => set("unitPrice", numField(e.target.value))} />
              </div>
              <div>
                <label className={label}>MSRP</label>
                <input className="input" type="number" step="0.01" value={form.msrp ?? ""} onChange={(e) => set("msrp", numField(e.target.value))} />
              </div>
              <div>
                <label className={label}>Unit type</label>
                <Select
                  ariaLabel="Unit type"
                  value={form.unitTypeId ?? ""}
                  onValueChange={(v) => set("unitTypeId", v)}
                  placeholder="Select unit"
                  options={[{ value: "", label: "Select unit" }, ...unitTypes.map((u) => ({ value: u.id, label: u.name }))]}
                />
              </div>
              <div>
                <label className={label}>Net qty / unit</label>
                <input className="input" type="number" step="0.001" value={form.netQuantityPerUnit ?? ""} onChange={(e) => set("netQuantityPerUnit", numField(e.target.value))} />
              </div>
              <div>
                <label className={label}>THC %</label>
                <input className="input" type="number" step="0.01" value={form.thcContent ?? ""} onChange={(e) => set("thcContent", numField(e.target.value))} />
              </div>
              <div>
                <label className={label}>CBD %</label>
                <input className="input" type="number" step="0.01" value={form.cbdContent ?? ""} onChange={(e) => set("cbdContent", numField(e.target.value))} />
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Description</h2>
            <textarea className="input min-h-24" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </section>
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Images</h2>
            {!isEdit && <p className="mb-2 text-xs text-muted">Save the product first, then add images.</p>}
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {img.isPrimary && (
                    <span className="absolute left-1 top-1 rounded bg-accent/90 px-1 text-[9px] font-medium text-white">Primary</span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {!img.isPrimary && (
                      <button title="Make primary" aria-label="Make primary" disabled={pending} onClick={() => imageAction(() => setPrimaryImageAction(img.id, initial.id!))} className="text-white hover:text-accent">
                        <Star size={13} />
                      </button>
                    )}
                    <button title="Delete image" aria-label="Delete image" disabled={pending} onClick={() => imageAction(() => deleteProductImageAction(img.id, initial.id!))} className="text-white hover:text-danger">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {isEdit && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || pending}
                  className="grid aspect-square place-items-center rounded-lg border border-dashed text-muted hover:text-fg"
                >
                  <ImagePlus size={18} />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Settings</h2>
            <div className={field}>
              <label className={label}>Status</label>
              <Select
                ariaLabel="Status"
                value={form.status ?? "ACTIVE"}
                onValueChange={(v) => set("status", v as "ACTIVE" | "ARCHIVED")}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "ARCHIVED", label: "Archived" },
                ]}
              />
            </div>
            <div className={field}>
              <label className={label}>Tracking method</label>
              <Select
                ariaLabel="Tracking method"
                value={form.trackingMethod ?? "PACKAGE"}
                onValueChange={(v) => set("trackingMethod", v as "PACKAGE" | "PRODUCT" | "BATCH")}
                options={[
                  { value: "PACKAGE", label: "Package" },
                  { value: "PRODUCT", label: "Product" },
                  { value: "BATCH", label: "Batch" },
                ]}
              />
            </div>
            <div className={field}>
              <label className={label}>On hand</label>
              <input className="input" type="number" value={form.onHand ?? ""} onChange={(e) => set("onHand", numField(e.target.value))} />
            </div>
            <label className="mb-1.5 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isInventoryItem ?? true} onChange={(e) => set("isInventoryItem", e.target.checked)} /> Tracked in inventory
            </label>
            <label className="mb-1.5 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.taxable ?? true} onChange={(e) => set("taxable", e.target.checked)} /> Taxable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isSample ?? false} onChange={(e) => set("isSample", e.target.checked)} /> Sample
            </label>
          </section>
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href={isEdit ? `/inventory/${initial.id}` : "/inventory"} className="btn btn-outline">Cancel</Link>
        <button className="btn btn-primary" onClick={save} disabled={pending || !form.name?.trim() || !form.sku?.trim()}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </button>
      </div>
    </div>
  );
}
