"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { saveCreditAction } from "@/app/(app)/sales/returns/actions";

const money = (n: number) => `$${n.toFixed(2)}`;
const shortDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString() : "-";

export type CreditRowView = {
  id: string;
  customer: string | null;
  amount: number;
  remaining: number;
  reason: string | null;
  createdAt: string | null;
};

export function CreditsManager({
  credits,
  customers,
}: {
  credits: CreditRowView[];
  customers: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const outstanding = credits.reduce((a, c) => a + c.remaining, 0);
  const issued = credits.reduce((a, c) => a + c.amount, 0);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveCreditAction({
        customer,
        amount: Number(amount),
        reason,
      });
      if (res.ok) {
        setOpen(false);
        setCustomer("");
        setAmount("");
        setReason("");
        router.refresh();
      } else {
        setError(res.error ?? "Could not create credit.");
      }
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Credits", credits.length],
          ["Issued", money(issued)],
          ["Remaining", money(outstanding)],
        ].map(([l, value]) => (
          <div key={l} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">{l}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center">
        <button
          className="btn btn-primary ml-auto"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus size={16} /> New credit
        </button>
      </div>

      {open && (
        <section className="card mb-4">
          <h2 className="mb-3 text-sm font-semibold">New credit</h2>
          {error && (
            <div className="mb-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <label className={label}>Amount</label>
              <input
                className="input w-full"
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={label}>Reason (optional)</label>
              <input
                className="input w-full"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Goodwill credit"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="btn btn-outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={pending || !customer.trim() || !(Number(amount) > 0)}
            >
              {pending ? "Saving…" : "Create credit"}
            </button>
          </div>
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-160 text-sm">
          <thead>
            <tr
              className="text-left text-muted"
              style={{ background: "var(--color-surface)" }}
            >
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Reason</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 text-right font-medium">Remaining</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((c) => (
              <tr
                key={c.id}
                className="border-t"
                style={{ background: "var(--color-surface)" }}
              >
                <td className="px-4 py-2.5">{c.customer ?? "-"}</td>
                <td className="px-4 py-2.5">{c.reason ?? "-"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {money(c.amount)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {money(c.remaining)}
                </td>
                <td className="px-4 py-2.5">{shortDate(c.createdAt)}</td>
              </tr>
            ))}
            {credits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No credits yet. Issue one from the New credit button.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
