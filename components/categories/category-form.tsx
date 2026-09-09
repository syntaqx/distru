"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { saveCategoryAction, type CategoryForm as CategoryFormData } from "@/app/(app)/categories/actions";

export function CategoryForm({ initial }: { initial: CategoryFormData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<CategoryFormData>(initial);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof CategoryFormData>(k: K, v: CategoryFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveCategoryAction(form);
      if (res.ok) router.push("/categories");
      else setError(res.error ?? "Could not save category.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {isEdit ? `Edit ${initial.name || "category"}` : "New category"}
          </h1>
          <p className="text-sm text-muted">
            {isEdit ? "Update this category." : "Add a category to organize your catalog."}
          </p>
        </div>
        <Link href="/categories" className="btn btn-ghost">
          <X size={16} /> Cancel
        </Link>
      </div>

      {error && <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Name</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </div>
          <div className="col-span-2">
            <label className={label}>BioTrack type (optional)</label>
            <input
              className="input"
              value={form.biotrackType ?? ""}
              onChange={(e) => set("biotrackType", e.target.value)}
              placeholder="e.g. Usable Marijuana"
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/categories" className="btn btn-outline">Cancel</Link>
        <button className="btn btn-primary" onClick={save} disabled={pending || !form.name?.trim()}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create category"}
        </button>
      </div>
    </div>
  );
}
