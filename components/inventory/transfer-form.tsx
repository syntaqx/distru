"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import {
  createTransferAction,
  type TransferForm as TransferFormData,
  type TransferLineForm,
} from "@/app/(app)/inventory/depth-actions";
import { Select } from "@/components/ui/select";

export type ProductOption = { id: string; name: string; sku: string };
export type LocationOption = { id: string; name: string };

export function TransferForm({
  products,
  locations,
}: {
  products: ProductOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<TransferFormData>({
    fromLocationId: "",
    toLocationId: "",
    notes: "",
    lines: [{ productId: "", quantity: "1" }],
  });
  const [error, setError] = useState<string | null>(null);

  const locationOptions = [
    { value: "", label: "Select a location…" },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];
  const productOptions = [
    { value: "", label: "Select a product…" },
    ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` })),
  ];

  const set = <K extends keyof TransferFormData>(k: K, v: TransferFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function setLine(idx: number, patch: Partial<TransferLineForm>) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }
  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, { productId: "", quantity: "1" }] }));
  }
  function removeLine(idx: number) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await createTransferAction(form);
      if (res.ok) router.push("/inventory/transfers");
      else setError(res.error ?? "Could not create transfer.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";
  const canSave =
    !!form.fromLocationId &&
    !!form.toLocationId &&
    form.fromLocationId !== form.toLocationId &&
    form.lines.some((l) => l.productId && Number(l.quantity) > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">New transfer</h1>
          <p className="text-sm text-muted">
            Move stock between locations - cost travels with the goods and a
            shortfall blocks the line.
          </p>
        </div>
        <Link href="/inventory/transfers" className="btn btn-ghost">
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
          <h2 className="mb-3 text-sm font-semibold">Locations</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>From</label>
              <Select
                ariaLabel="From location"
                value={form.fromLocationId}
                onValueChange={(v) => set("fromLocationId", v)}
                placeholder="Select a location…"
                options={locationOptions}
              />
            </div>
            <div>
              <label className={label}>To</label>
              <Select
                ariaLabel="To location"
                value={form.toLocationId}
                onValueChange={(v) => set("toLocationId", v)}
                placeholder="Select a location…"
                options={locationOptions}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lines</h2>
            <button className="btn btn-ghost px-2 py-1" onClick={addLine}>
              <Plus size={14} /> Add line
            </button>
          </div>
          <div className="space-y-2">
            {form.lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="col-span-2">
                  <Select
                    ariaLabel={`Product ${idx + 1}`}
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
                    aria-label={`Quantity ${idx + 1}`}
                    value={line.quantity}
                    onChange={(e) => setLine(idx, { quantity: e.target.value })}
                  />
                  <button
                    className="btn btn-ghost px-2 py-1"
                    onClick={() => removeLine(idx)}
                    disabled={form.lines.length === 1}
                    aria-label={`Remove line ${idx + 1}`}
                    title="Remove line"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <label className={label}>Notes</label>
          <input
            className="input"
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional"
          />
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/inventory/transfers" className="btn btn-outline">
          Cancel
        </Link>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={pending || !canSave}
        >
          {pending ? "Transferring…" : "Create transfer"}
        </button>
      </div>
    </div>
  );
}
