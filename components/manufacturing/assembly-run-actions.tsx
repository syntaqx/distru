"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Play } from "lucide-react";
import {
  completeAssemblyAction,
  startAssemblyAction,
} from "@/app/(app)/manufacturing/actions";

/**
 * Run controls for an assembly that has not posted inventory yet.
 *  - Start run: PENDING -> IN_PROGRESS, opening soft reservations on inputs.
 *  - Complete run: consumes inputs FIFO and produces outputs at a rolled cost.
 * A shortfall throws, which we surface inline.
 */
export function AssemblyRunActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) router.refresh();
      else setError(res.error ?? fallback);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" && (
          <button
            className="btn btn-outline"
            disabled={pending}
            onClick={() => run(() => startAssemblyAction(id), "Could not start run.")}
            title="Start run (reserves input stock)"
          >
            <Play size={15} /> {pending ? "Working…" : "Start run"}
          </button>
        )}
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() => run(() => completeAssemblyAction(id), "Could not complete run.")}
          title="Complete run (consumes inputs, produces outputs, posts inventory)"
        >
          <CheckCircle2 size={15} /> {pending ? "Working…" : "Complete run"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {status === "PENDING"
          ? "Starting reserves inputs so they aren't double-committed. Completing then consumes inputs FIFO and produces outputs at a rolled unit cost - this posts inventory and cannot be undone."
          : "Completing consumes inputs FIFO and produces outputs at a rolled unit cost. This cannot be undone once inventory is posted."}
      </p>
      {error && <div className="mt-2 text-sm text-danger">{error}</div>}
    </div>
  );
}
