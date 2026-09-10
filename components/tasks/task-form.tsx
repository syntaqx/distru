"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { saveTaskAction, type TaskForm as TaskFormData } from "@/app/(app)/tasks/actions";
import { Select } from "@/components/ui/select";

export type Option = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: "OPEN", label: "To do" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

/** Convert a stored ISO datetime to the YYYY-MM-DD a <input type=date> expects. */
function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TaskForm({
  initial,
  members,
  companies,
  orders,
}: {
  initial: TaskFormData;
  members: Option[];
  companies: Option[];
  orders: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<TaskFormData>(initial);
  const [due, setDue] = useState(toDateInput(initial.dueAt));
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!initial.id;

  const set = <K extends keyof TaskFormData>(k: K, v: TaskFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const linkOptions =
    form.entityType === "company"
      ? companies
      : form.entityType === "order"
        ? orders
        : [];

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveTaskAction({
        ...form,
        dueAt: due ? due : null,
        entityType: form.entityType || null,
        entityId: form.entityType && form.entityId ? form.entityId : null,
      });
      if (res.ok) router.push("/tasks");
      else setError(res.error ?? "Could not save task.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{isEdit ? "Edit task" : "New task"}</h1>
          <p className="text-sm text-muted">
            {isEdit ? "Update this task's details." : "Add a task to your board and calendar."}
          </p>
        </div>
        <Link href="/tasks" className="btn btn-ghost">
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
            <div className="sm:col-span-2">
              <label className={label}>Title</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="What needs doing?"
                autoFocus
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Description</label>
              <textarea
                className="input min-h-24"
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Optional details"
              />
            </div>
            <div>
              <label className={label}>Status</label>
              <Select
                ariaLabel="Status"
                value={form.status}
                onValueChange={(v) => set("status", v)}
                options={STATUS_OPTIONS}
              />
            </div>
            <div>
              <label className={label}>Priority</label>
              <Select
                ariaLabel="Priority"
                value={form.priority}
                onValueChange={(v) => set("priority", v)}
                options={PRIORITY_OPTIONS}
              />
            </div>
            <div>
              <label className={label}>Due date</label>
              <input
                type="date"
                className="input"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Assignee</label>
              <Select
                ariaLabel="Assignee"
                value={form.assigneeId ?? ""}
                onValueChange={(v) => set("assigneeId", v)}
                placeholder="Unassigned"
                options={[
                  { value: "", label: "Unassigned" },
                  ...members.map((m) => ({ value: m.id, label: m.name })),
                ]}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Linked record</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Type</label>
              <Select
                ariaLabel="Link type"
                value={form.entityType ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, entityType: v || null, entityId: null }))}
                placeholder="None"
                options={[
                  { value: "", label: "None" },
                  { value: "company", label: "Company" },
                  { value: "order", label: "Order" },
                ]}
              />
            </div>
            {form.entityType && (
              <div>
                <label className={label}>{form.entityType === "company" ? "Company" : "Order"}</label>
                <Select
                  ariaLabel="Linked record"
                  value={form.entityId ?? ""}
                  onValueChange={(v) => set("entityId", v)}
                  placeholder={`Select ${form.entityType}`}
                  options={[
                    { value: "", label: `Select ${form.entityType}` },
                    ...linkOptions.map((o) => ({ value: o.id, label: o.name })),
                  ]}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t bg-bg/80 py-3 backdrop-blur">
        <Link href="/tasks" className="btn btn-outline">
          Cancel
        </Link>
        <button className="btn btn-primary" onClick={save} disabled={pending || !form.title?.trim()}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create task"}
        </button>
      </div>
    </div>
  );
}
