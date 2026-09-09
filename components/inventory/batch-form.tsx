"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  saveBatchAction,
  type BatchForm as BatchFormData,
} from "@/app/(app)/inventory/depth-actions";
import { Combobox } from "@/components/ui/combobox";

export type ProductOption = { id: string; name: string };

export function BatchForm({
  initial,
  products,
}: {
  initial: BatchFormData;
  products: ProductOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<BatchFormData>(initial);
  const [productLabel, setProductLabel] = useState(
    products.find((p) => p.id === initial.productId)?.name ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof BatchFormData>(k: K, v: BatchFormData[K]) =>
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
      const res = await saveBatchAction(form);
      if (res.ok) router.push("/inventory/batches");
      else setError(res.error ?? "Could not save batch.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.batchNumber || "batch"}` : "New batch"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit
              ? "Update this production lot."
              : "Register a production or harvest lot."}
          </p>
        </div>
        <Link href="/inventory/batches" className="btn btn-ghost">
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
              <label className={label}>Batch number</label>
              <input
                className="input"
                value={form.batchNumber}
                onChange={(e) => set("batchNumber", e.target.value)}
                placeholder="B-2026-0001"
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
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/inventory/batches" className="btn btn-outline">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={pending || !form.batchNumber?.trim()}
        >
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create batch"}
        </button>
      </div>
    </div>
  );
}
