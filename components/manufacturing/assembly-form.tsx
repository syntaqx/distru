"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import {
  saveAssemblyAction,
  type AssemblyForm as AssemblyFormData,
  type AssemblyLineForm,
} from "@/app/(app)/manufacturing/actions";
import { Select } from "@/components/ui/select";

export type ProductOption = { id: string; sku: string; name: string };

const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELED"] as const;

export function AssemblyForm({
  products,
  assemblyNumber,
}: {
  products: ProductOption[];
  assemblyNumber: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<AssemblyFormData>({
    status: "PENDING",
    outputProductId: "",
    outputQuantity: "1",
    inputs: [{ productId: "", quantity: "1" }],
  });
  const [error, setError] = useState<string | null>(null);

  const productOptions = [
    { value: "", label: "Select a product…" },
    ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
  ];

  const set = <K extends keyof AssemblyFormData>(k: K, v: AssemblyFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function setLine(idx: number, patch: Partial<AssemblyLineForm>) {
    setForm((f) => ({
      ...f,
      inputs: f.inputs.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
  function addLine() {
    setForm((f) => ({ ...f, inputs: [...f.inputs, { productId: "", quantity: "1" }] }));
  }
  function removeLine(idx: number) {
    setForm((f) => ({ ...f, inputs: f.inputs.filter((_, i) => i !== idx) }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveAssemblyAction(form);
      if (res.ok && res.id) router.push(`/manufacturing/${res.id}`);
      else setError(res.error ?? "Could not save assembly.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";
  const canSave =
    !!form.outputProductId &&
    Number(form.outputQuantity) > 0 &&
    form.inputs.some((l) => l.productId && Number(l.quantity) > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">New assembly</h1>
          <p className="text-sm text-muted">
            {assemblyNumber} · consume input inventory to yield a finished
            product.
          </p>
        </div>
        <Link href="/manufacturing" className="btn btn-ghost">
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
          <h2 className="mb-3 text-sm font-semibold">Output</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={label}>Output product</label>
              <Select
                ariaLabel="Output product"
                value={form.outputProductId}
                onValueChange={(v) => set("outputProductId", v)}
                placeholder="Select a product…"
                options={productOptions}
              />
            </div>
            <div>
              <label className={label}>Quantity</label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                value={form.outputQuantity}
                onChange={(e) => set("outputQuantity", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Inputs (bill of materials)</h2>
            <button className="btn btn-ghost px-2 py-1" onClick={addLine}>
              <Plus size={14} /> Add input
            </button>
          </div>
          <div className="space-y-2">
            {form.inputs.map((line, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Select
                    ariaLabel={`Input product ${idx + 1}`}
                    value={line.productId}
                    onValueChange={(v) => setLine(idx, { productId: v })}
                    placeholder="Select a product…"
                    options={productOptions}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`Input quantity ${idx + 1}`}
                    value={line.quantity}
                    onChange={(e) => setLine(idx, { quantity: e.target.value })}
                  />
                  <button
                    className="btn btn-ghost px-2 py-1"
                    onClick={() => removeLine(idx)}
                    disabled={form.inputs.length === 1}
                    aria-label={`Remove input ${idx + 1}`}
                    title="Remove input"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Status</h2>
          <div className="max-w-xs">
            <Select
              ariaLabel="Status"
              value={form.status}
              onValueChange={(v) => set("status", v as AssemblyFormData["status"])}
              options={STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/manufacturing" className="btn btn-outline">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={pending || !canSave}
        >
          {pending ? "Saving…" : "Create assembly"}
        </button>
      </div>
    </div>
  );
}
