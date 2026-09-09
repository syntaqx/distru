"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, PackageCheck } from "lucide-react";
import {
  receivePurchaseOrderAction,
  setPurchaseOrderStatusAction,
} from "@/app/(app)/purchasing/actions";

/** The forward PO lifecycle, for the "advance status" action. */
const PO_FLOW = ["DRAFT", "OPEN", "RECEIVED"] as const;

export function PoActions({
  poNumber,
  status,
}: {
  poNumber: string;
  status: string;
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

  const idx = PO_FLOW.indexOf(status as (typeof PO_FLOW)[number]);
  const next = idx >= 0 && idx < PO_FLOW.length - 1 ? PO_FLOW[idx + 1] : null;
  const canReceive = status !== "RECEIVED" && status !== "CANCELED";

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {next && next !== "RECEIVED" && (
          <button
            className="btn btn-outline"
            title={`Advance to ${next}`}
            disabled={pending}
            onClick={() =>
              run(() => setPurchaseOrderStatusAction(poNumber, next))
            }
          >
            <CheckCircle2 size={15} /> Advance to {next}
          </button>
        )}

        {canReceive && (
          <button
            className="btn btn-outline"
            title="Receive (posts inventory)"
            disabled={pending}
            onClick={() => run(() => receivePurchaseOrderAction(poNumber))}
          >
            <PackageCheck size={15} /> Receive
          </button>
        )}

        {status !== "CANCELED" && (
          <button
            className="btn btn-ghost text-danger"
            title="Cancel (reverses received stock)"
            disabled={pending}
            onClick={() =>
              run(() => setPurchaseOrderStatusAction(poNumber, "CANCELED"))
            }
          >
            <Ban size={15} /> Cancel PO
          </button>
        )}
      </div>
      {error && <div className="mt-2 text-sm text-danger">{error}</div>}
    </div>
  );
}
