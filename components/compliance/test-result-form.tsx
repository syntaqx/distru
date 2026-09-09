"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import {
  saveTestResultAction,
  type TestResultForm as TestResultFormData,
} from "@/app/(app)/compliance/actions";
import { Select } from "@/components/ui/select";

export type Option = { id: string; name: string };

const RESULTS = ["PASS", "FAIL", "PENDING"] as const;

export function TestResultForm({
  initial,
  products,
}: {
  initial: TestResultFormData;
  products: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<TestResultFormData>(initial);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TestResultFormData>(
    k: K,
    v: TestResultFormData[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveTestResultAction(form);
      if (res.ok) router.push("/compliance");
      else setError(res.error ?? "Could not save COA.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">New COA</h1>
          <p className="text-sm text-muted">
            Record a certificate of analysis / lab test result for a product.
          </p>
        </div>
        <Link href="/compliance" className="btn btn-ghost">
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="card">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Product</label>
            <Select
              ariaLabel="Product"
              value={form.productId ?? ""}
              onValueChange={(v) => set("productId", v)}
              placeholder="No product"
              options={[
                { value: "", label: "No product" },
                ...products.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>
          <div>
            <label className={label}>Result</label>
            <Select
              ariaLabel="Result"
              value={form.passed ?? ""}
              onValueChange={(v) => set("passed", v)}
              placeholder="Select result"
              options={[
                { value: "", label: "Select result" },
                ...RESULTS.map((r) => ({ value: r, label: r })),
              ]}
            />
          </div>
          <div>
            <label className={label}>Tested date</label>
            <input
              type="date"
              className="input"
              value={form.testedAt ?? ""}
              onChange={(e) => set("testedAt", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={label}>Notes</label>
            <textarea
              className="input min-h-24"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Analytes, lab, or any notes (optional)"
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/compliance" className="btn btn-outline">
          Cancel
        </Link>
        <button className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Create COA"}
        </button>
      </div>
    </div>
  );
}
