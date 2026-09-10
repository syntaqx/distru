"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, Plus, User, X } from "lucide-react";
import { saveContactAction } from "@/app/(app)/companies/actions";

export type ContactRow = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
};

type Draft = {
  id?: string;
  name: string;
  title: string;
  email: string;
  phone: string;
};

const EMPTY: Draft = { name: "", title: "", email: "", phone: "" };

export function ContactsPanel({
  companyId,
  contacts,
  primaryContactId,
}: {
  companyId: string;
  contacts: ContactRow[];
  primaryContactId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  function edit(c: ContactRow) {
    setError(null);
    setDraft({
      id: c.id,
      name: c.name,
      title: c.title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
    });
  }

  function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("Contact name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveContactAction({
        id: draft.id,
        companyId,
        name: draft.name,
        title: draft.title || null,
        email: draft.email || null,
        phone: draft.phone || null,
      });
      if (res.ok) {
        setDraft(null);
        router.refresh();
      } else {
        setError(res.error ?? "Could not save contact.");
      }
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Contacts</h2>
        {!draft && (
          <button className="btn btn-outline px-2 py-1" onClick={() => { setError(null); setDraft({ ...EMPTY }); }}>
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {error && <div className="mb-3 text-sm text-danger">{error}</div>}

      {draft && (
        <div className="mb-4 rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold">{draft.id ? "Edit contact" : "New contact"}</span>
            <button className="btn btn-ghost px-2 py-1" onClick={() => setDraft(null)} aria-label="Cancel">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>Name</label>
              <input className="input" value={draft.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </div>
            <div>
              <label className={label}>Title</label>
              <input className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input className="input" value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Email</label>
              <input className="input" type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setDraft(null)} disabled={pending}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={pending || !draft.name.trim()}>
              {pending ? "Saving…" : "Save contact"}
            </button>
          </div>
        </div>
      )}

      {contacts.length === 0 && !draft ? (
        <p className="text-sm text-muted">No contacts linked to this company.</p>
      ) : (
        <ul className="divide-y">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <User size={14} className="text-muted" />
                  <span className="font-medium">{c.name}</span>
                  {c.id === primaryContactId && <span className="badge">Primary</span>}
                  {c.title && <span className="text-xs text-muted">{c.title}</span>}
                </div>
                <div className="mt-1 flex flex-col gap-1 text-xs text-muted sm:flex-row sm:gap-4">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:underline">
                      <Mail size={12} /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone size={12} /> {c.phone}
                    </a>
                  )}
                </div>
              </div>
              <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => edit(c)}>
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
