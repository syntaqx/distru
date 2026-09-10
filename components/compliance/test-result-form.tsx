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
  packages = [],
}: {
  initial: TestResultFormData;
  products: Option[];
  packages?: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<TestResultFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(initial.id);

  const set = <K extends keyof TestResultFormData>(
    k: K,
    v: TestResultFormData[K],
  ) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveTestResultAction(form);
      if (res.ok) router.push(res.id ? `/compliance/test-results/${res.id}` : "/compliance");
      else setError(res.error ?? "Could not save COA.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{editing ? "Edit COA" : "New COA"}</h1>
          <p className="text-sm text-muted">
            Record a certificate of analysis / lab test result, with structured
            potency and an optional package link for lot-level traceability.
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
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
            <label className={label}>Package (lot-level)</label>
            <Select
              ariaLabel="Package"
              value={form.packageId ?? ""}
              onValueChange={(v) => set("packageId", v)}
              placeholder="No package"
              options={[
                { value: "", label: "No package" },
                ...packages.map((p) => ({ value: p.id, label: p.name })),
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
        </div>
      </section>

      <section className="card mt-4">
        <h2 className="mb-3 text-sm font-semibold">Potency</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className={label}>THC %</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.thcPercentage ?? ""}
              onChange={(e) => set("thcPercentage", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>CBD %</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.cbdPercentage ?? ""}
              onChange={(e) => set("cbdPercentage", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>THC mg/unit</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.thcMgPerUnit ?? ""}
              onChange={(e) => set("thcMgPerUnit", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>CBD mg/unit</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.cbdMgPerUnit ?? ""}
              onChange={(e) => set("cbdMgPerUnit", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card mt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Metrc lab test id</label>
            <input
              className="input"
              value={form.metrcLabTestId ?? ""}
              placeholder="LT-00000"
              onChange={(e) => set("metrcLabTestId", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>COA document URL</label>
            <input
              className="input"
              value={form.coaUrl ?? ""}
              placeholder="https://…"
              onChange={(e) => set("coaUrl", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
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
          {pending ? "Saving…" : editing ? "Save COA" : "Create COA"}
        </button>
      </div>
    </div>
  );
}
