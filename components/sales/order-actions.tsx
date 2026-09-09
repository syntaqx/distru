"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CheckCircle2, FileText } from "lucide-react";
import {
  cancelOrderAction,
  createInvoiceAction,
  setOrderStatusAction,
} from "@/app/(app)/sales/actions";

/** The forward order lifecycle, for the "advance status" action. */
const ORDER_FLOW = [
  "PENDING",
  "PROCESSING",
  "READY_TO_SHIP",
  "DELIVERING",
  "DELIVERED",
  "COMPLETED",
] as const;

export function OrderActions({
  orderNumber,
  status,
  invoiceNumber,
}: {
  orderNumber: string;
  status: string;
  invoiceNumber: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Something went wrong.");
    });
  }

  const idx = ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number]);
  const next = idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1] : null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {next && (
          <button
            className="btn btn-outline"
            title={`Advance to ${next}${status === "PENDING" ? " (decrements stock)" : ""}`}
            disabled={pending}
            onClick={() => run(() => setOrderStatusAction(orderNumber, next))}
          >
            <CheckCircle2 size={15} /> Advance to {next}
          </button>
        )}

        {status !== "PENDING" &&
          status !== "CANCELED" &&
          (invoiceNumber ? (
            <Link
              href={`/sales/invoices/${invoiceNumber}`}
              className="btn btn-outline"
            >
              <FileText size={15} /> View invoice
            </Link>
          ) : (
            <button
              className="btn btn-outline"
              title="Create invoice"
              disabled={pending}
              onClick={() => run(() => createInvoiceAction(orderNumber))}
            >
              <FileText size={15} /> Create invoice
            </button>
          ))}

        {status !== "CANCELED" && status !== "COMPLETED" && (
          <button
            className="btn btn-ghost text-danger"
            title="Cancel (restores stock)"
            disabled={pending}
            onClick={() => run(() => cancelOrderAction(orderNumber))}
          >
            <Ban size={15} /> Cancel order
          </button>
        )}
      </div>
      {error && <div className="mt-2 text-sm text-danger">{error}</div>}
    </div>
  );
}
