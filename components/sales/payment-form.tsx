"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { recordPaymentAction } from "@/app/(app)/sales/actions";

const money = (n: number) => `$${n.toFixed(2)}`;

export function PaymentForm({
  invoiceNumber,
  balance,
}: {
  invoiceNumber: string;
  balance: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState<number>(Number(balance.toFixed(2)));
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }
    if (amount > balance + 1e-6) {
      setError(`Payment exceeds the balance due (${money(balance)}).`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await recordPaymentAction(invoiceNumber, amount);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not record payment.");
    });
  }

  return (
    <div>
      <div className="mb-3 text-sm text-muted">
        Balance due{" "}
        <span className="font-semibold text-fg">{money(balance)}</span>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">
            Amount
          </label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            max={balance}
            value={Number.isFinite(amount) ? amount : ""}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={
            pending ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount > balance + 1e-6
          }
        >
          <Receipt size={15} /> {pending ? "Saving…" : "Record payment"}
        </button>
      </div>
      {error && <div className="mt-2 text-sm text-danger">{error}</div>}
    </div>
  );
}
