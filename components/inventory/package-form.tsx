"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  savePackageAction,
  type PackageForm as PackageFormData,
} from "@/app/(app)/inventory/depth-actions";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";

export type ProductOption = { id: string; name: string };
export type LocationOption = { id: string; name: string };

const STATUSES = ["ACTIVE", "INACTIVE", "FINISHED", "ON_HOLD"] as const;

export function PackageForm({
  initial,
  products,
  locations,
}: {
  initial: PackageFormData;
  products: ProductOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<PackageFormData>(initial);
  const [productLabel, setProductLabel] = useState(
    products.find((p) => p.id === initial.productId)?.name ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof PackageFormData>(k: K, v: PackageFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function onProductInput(text: string) {
    setProductLabel(text);
    const match = products.find(
      (p) => p.id === text || p.name.toLowerCase() === text.trim().toLowerCase(),
    );
    set("productId", match?.id ?? "");
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePackageAction(form);
      if (res.ok) router.push("/inventory/packages");
      else setError(res.error ?? "Could not save package.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.packageTag || "package"}` : "New package"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit
              ? "Update this tagged package."
              : "Register a tagged, Metrc-style unit of a product."}
          </p>
        </div>
        <Link href="/inventory/packages" className="btn btn-ghost">
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <section className="card">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Package tag</label>
              <input
                className="input"
                value={form.packageTag}
                onChange={(e) => set("packageTag", e.target.value)}
                placeholder="1A4000000000000000000001"
                autoFocus
              />
            </div>
            <div className="col-span-2">
              <label className={label}>Product</label>
              <Combobox
                ariaLabel="Product"
                value={productLabel}
                onValueChange={onProductInput}
                placeholder="Search products…"
                options={products.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <label className={label}>Quantity</label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                value={form.quantity ?? ""}
                onChange={(e) => set("quantity", e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={label}>Location</label>
              <Select
                ariaLabel="Location"
                value={form.locationId ?? ""}
                onValueChange={(v) => set("locationId", v)}
                placeholder="No location"
                options={[
                  { value: "", label: "No location" },
                  ...locations.map((l) => ({ value: l.id, label: l.name })),
                ]}
              />
            </div>
            <div>
              <label className={label}>Status</label>
              <Select
                ariaLabel="Status"
                value={form.status}
                onValueChange={(v) => set("status", v)}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/inventory/packages" className="btn btn-outline">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={pending || !form.packageTag?.trim()}
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create package"}
        </button>
      </div>
    </div>
  );
}
