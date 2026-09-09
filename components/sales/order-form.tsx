"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  createOrderAction,
  type OrderLineForm,
} from "@/app/(app)/sales/actions";
import type { ProductOption } from "@/components/sales/sales-manager";

const money = (n: number) => `$${n.toFixed(2)}`;

export function OrderForm({
  products,
  customers,
}: {
  products: ProductOption[];
  customers: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState<"PENDING" | "PROCESSING">("PROCESSING");
  const [lines, setLines] = useState<OrderLineForm[]>([
    { sku: "", quantity: 1 },
  ]);
  const [error, setError] = useState<string | null>(null);

  const skuToProduct = useMemo(
    () => new Map(products.map((p) => [p.sku.toLowerCase(), p])),
    [products],
  );

  const total = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const p = skuToProduct.get(l.sku.toLowerCase());
        const price = l.unitPrice ?? p?.unitPrice ?? 0;
        return sum + Number(l.quantity || 0) * Number(price || 0);
      }, 0),
    [lines, skuToProduct],
  );

  const setLine = (idx: number, patch: Partial<OrderLineForm>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await createOrderAction({ customer, status, lines });
      if (res.ok) {
        router.push(res.orderNumber ? `/sales/orders/${res.orderNumber}` : "/sales");
      } else {
        setError(res.error ?? "Could not create order.");
      }
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">New sales order</h1>
          <p className="text-sm text-muted">
            Pick a customer and add line items - processing an order decrements
            stock.
          </p>
        </div>
        <Link href="/sales" className="btn btn-ghost">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Customer</label>
              <Combobox
                ariaLabel="Customer"
                value={customer}
                onValueChange={setCustomer}
                placeholder="Search or add a customer…"
                options={customers.map((c) => ({ value: c, label: c }))}
              />
            </div>
            <div>
              <label className={label}>On save</label>
              <Select
                ariaLabel="On save"
                value={status}
                onValueChange={(v) => setStatus(v as "PENDING" | "PROCESSING")}
                options={[
                  { value: "PROCESSING", label: "Process now (decrements stock)" },
                  { value: "PENDING", label: "Save as pending (no stock change)" },
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
                  <span className="min-w-32 flex-1 truncate text-xs text-muted">
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
                    value={line.unitPrice ?? p?.unitPrice ?? ""}
                    onChange={(e) =>
                      setLine(idx, {
                        unitPrice:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="price"
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
          <Link href="/sales" className="btn btn-outline">
            Cancel
          </Link>
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={pending || !customer.trim()}
          >
            {pending ? "Saving…" : "Create order"}
          </button>
        </div>
      </div>
    </div>
  );
}
