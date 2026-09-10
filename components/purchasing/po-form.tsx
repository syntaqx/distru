"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  createPurchaseOrderAction,
  type PoLineForm,
} from "@/app/(app)/purchasing/actions";

export type PoProductOption = { sku: string; name: string };

const money = (n: number) => `$${n.toFixed(2)}`;

export function PoForm({
  products,
  vendors,
}: {
  products: PoProductOption[];
  vendors: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [vendor, setVendor] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "OPEN" | "RECEIVED">("OPEN");
  const [lines, setLines] = useState<PoLineForm[]>([{ sku: "", quantity: 1 }]);
  const [error, setError] = useState<string | null>(null);

  const skuToProduct = useMemo(
    () => new Map(products.map((p) => [p.sku.toLowerCase(), p])),
    [products],
  );

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + Number(l.quantity || 0) * Number(l.unitCost || 0),
        0,
      ),
    [lines],
  );

  const setLine = (idx: number, patch: Partial<PoLineForm>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await createPurchaseOrderAction({ vendor, status, lines });
      if (res.ok) {
        router.push(res.number ? `/purchasing/${res.number}` : "/purchasing");
      } else {
        setError(res.error ?? "Could not create purchase order.");
      }
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">New purchase order</h1>
          <p className="text-sm text-muted">
            Pick a vendor and add line items - receiving a PO increments stock.
          </p>
        </div>
        <Link href="/purchasing" className="btn btn-ghost">
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
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Vendor</label>
              <Combobox
                ariaLabel="Vendor"
                value={vendor}
                onValueChange={setVendor}
                placeholder="Search or add a vendor…"
                options={vendors.map((v) => ({ value: v, label: v }))}
              />
            </div>
            <div>
              <label className={label}>On save</label>
              <Select
                ariaLabel="On save"
                value={status}
                onValueChange={(v) =>
                  setStatus(v as "DRAFT" | "OPEN" | "RECEIVED")
                }
                options={[
                  { value: "OPEN", label: "Open (awaiting receipt)" },
                  { value: "DRAFT", label: "Draft (not yet placed)" },
                  { value: "RECEIVED", label: "Received now (increments stock)" },
                ]}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Line items</h2>
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const p = skuToProduct.get(line.sku.toLowerCase());
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Combobox
                      ariaLabel="Product SKU"
                      value={line.sku}
                      onValueChange={(v) => setLine(idx, { sku: v })}
                      placeholder="Search products by name or SKU…"
                      options={products.map((pr) => ({
                        value: pr.sku,
                        label: `${pr.name} · ${pr.sku}`,
                      }))}
                    />
                  </div>
                  <span className="hidden min-w-32 flex-1 truncate text-xs text-muted sm:block">
                    {p?.name ?? ""}
                  </span>
                  <input
                    className="input w-20"
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setLine(idx, { quantity: Number(e.target.value) })
                    }
                  />
                  <input
                    className="input w-24"
                    type="number"
                    step="0.01"
                    value={line.unitCost ?? ""}
                    onChange={(e) =>
                      setLine(idx, {
                        unitCost:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="cost"
                  />
                  <button
                    className="btn btn-ghost px-2 py-1"
                    title="Remove line"
                    aria-label="Remove line"
                    onClick={() =>
                      setLines((ls) => ls.filter((_, i) => i !== idx))
                    }
                    disabled={lines.length === 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            className="btn btn-outline mt-2"
            onClick={() => setLines((ls) => [...ls, { sku: "", quantity: 1 }])}
          >
            <Plus size={14} /> Add line
          </button>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <div className="text-sm text-muted">
          Total <span className="font-semibold text-fg">{money(total)}</span>
        </div>
        <div className="flex gap-2">
          <Link href="/purchasing" className="btn btn-outline">
            Cancel
          </Link>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={pending || !vendor.trim()}
          >
            {pending ? "Saving…" : "Create PO"}
          </button>
        </div>
      </div>
    </div>
  );
}
