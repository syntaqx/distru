"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  saveCompanyGroupAction,
  saveLocationAction,
  saveMenuAction,
  savePaymentMethodAction,
  savePaymentTermAction,
  savePriceTierAction,
  saveProductGroupAction,
  saveProductSubcategoryAction,
  saveStrainAction,
  saveTaxAction,
  type SaveResult,
} from "@/app/(app)/settings/reference/actions";

export type ReferenceRow = { id: string; name: string; meta?: string | null };
export type ResourceKey =
  | "taxes"
  | "priceTiers"
  | "paymentTerms"
  | "paymentMethods"
  | "strains"
  | "subcategories"
  | "productGroups"
  | "companyGroups"
  | "menus"
  | "locations"
  | "unitTypes";

export type ReferenceData = Record<ResourceKey, ReferenceRow[]>;

type Field = { key: "name" | "rate" | "netDays" | "type"; label: string; placeholder?: string; type?: string };

type ResourceDef = {
  key: ResourceKey;
  label: string;
  /** Header + accessor for the optional second column. */
  metaLabel?: string;
  /** Present when the resource supports create; absent for read-only ones. */
  create?: {
    fields: Field[];
    action: (v: Record<string, string>) => Promise<SaveResult>;
  };
  note?: string;
};

const RESOURCES: ResourceDef[] = [
  {
    key: "taxes",
    label: "Taxes",
    metaLabel: "Rate",
    create: {
      fields: [
        { key: "name", label: "Name", placeholder: "State excise" },
        { key: "rate", label: "Rate", placeholder: "0.15", type: "number" },
      ],
      action: (v) => saveTaxAction({ name: v.name, rate: v.rate }),
    },
  },
  {
    key: "priceTiers",
    label: "Price tiers",
    create: {
      fields: [{ key: "name", label: "Name", placeholder: "Wholesale" }],
      action: (v) => savePriceTierAction({ name: v.name }),
    },
  },
  {
    key: "paymentTerms",
    label: "Payment terms",
    metaLabel: "Net days",
    create: {
      fields: [
        { key: "name", label: "Name", placeholder: "Net 30" },
        { key: "netDays", label: "Net days", placeholder: "30", type: "number" },
      ],
      action: (v) => savePaymentTermAction({ name: v.name, netDays: v.netDays }),
    },
  },
  {
    key: "paymentMethods",
    label: "Payment methods",
    create: {
      fields: [{ key: "name", label: "Name", placeholder: "ACH" }],
      action: (v) => savePaymentMethodAction({ name: v.name }),
    },
  },
  {
    key: "strains",
    label: "Strains",
    metaLabel: "Type",
    create: {
      fields: [
        { key: "name", label: "Name", placeholder: "Blue Dream" },
        { key: "type", label: "Type", placeholder: "Hybrid" },
      ],
      action: (v) => saveStrainAction({ name: v.name, type: v.type }),
    },
  },
  {
    key: "subcategories",
    label: "Subcategories",
    create: {
      fields: [{ key: "name", label: "Name", placeholder: "Pre-rolls" }],
      action: (v) => saveProductSubcategoryAction({ name: v.name }),
    },
  },
  {
    key: "productGroups",
    label: "Product groups",
    create: {
      fields: [{ key: "name", label: "Name", placeholder: "Top shelf" }],
      action: (v) => saveProductGroupAction({ name: v.name }),
    },
  },
  {
    key: "companyGroups",
    label: "Company groups",
    create: {
      fields: [{ key: "name", label: "Name", placeholder: "Key accounts" }],
      action: (v) => saveCompanyGroupAction({ name: v.name }),
    },
  },
  {
    key: "menus",
    label: "Menus",
    create: {
      fields: [{ key: "name", label: "Name", placeholder: "Live menu" }],
      action: (v) => saveMenuAction({ name: v.name }),
    },
  },
  {
    key: "locations",
    label: "Locations",
    create: {
      fields: [{ key: "name", label: "Name", placeholder: "Main Warehouse" }],
      action: (v) => saveLocationAction({ name: v.name }),
    },
  },
  {
    key: "unitTypes",
    label: "Unit types",
    note: "Unit types are a fixed global set and can't be edited.",
  },
];

export function ReferenceView({ data }: { data: ReferenceData }) {
  const router = useRouter();
  const [active, setActive] = useState<ResourceKey>("taxes");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const def = useMemo(() => RESOURCES.find((r) => r.key === active)!, [active]);
  const rows = data[active] ?? [];

  function selectResource(key: ResourceKey) {
    setActive(key);
    setError(null);
    setDraft({});
  }

  function run(fn: () => Promise<SaveResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setDraft({});
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  function onAdd() {
    if (!def.create) return;
    run(() => def.create!.action(draft));
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[13rem_1fr]">
      <nav className="flex flex-row flex-wrap gap-1 md:flex-col" aria-label="Reference resources">
        {RESOURCES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => selectResource(r.key)}
            aria-current={active === r.key ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              active === r.key ? "font-medium" : "text-muted hover:text-[var(--color-fg)]"
            }`}
            style={active === r.key ? { background: "var(--color-surface)", color: "var(--color-accent)" } : undefined}
          >
            {r.label}
          </button>
        ))}
      </nav>

      <section>
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">{def.label}</h2>
          <span className="text-xs text-muted">{rows.length} item(s)</span>
        </header>

        {def.note && <p className="mb-3 text-sm text-muted">{def.note}</p>}
        {error && <div className="mb-3 text-sm text-danger">{error}</div>}

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-96 text-sm">
            <thead>
              <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
                <th className="px-4 py-2.5 font-medium">Name</th>
                {def.metaLabel && <th className="px-4 py-2.5 font-medium">{def.metaLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  {def.metaLabel && (
                    <td className="px-4 py-2.5 text-muted">{row.meta ?? "—"}</td>
                  )}
                </tr>
              ))}

              {def.create && (
                <tr className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2" colSpan={def.metaLabel ? 2 : 1}>
                    <div className="flex flex-wrap items-center gap-2">
                      {def.create.fields.map((f) => (
                        <input
                          key={f.key}
                          className="input max-w-48"
                          type={f.type ?? "text"}
                          value={draft[f.key] ?? ""}
                          placeholder={f.placeholder ?? f.label}
                          aria-label={f.label}
                          disabled={pending}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onAdd();
                            }
                          }}
                        />
                      ))}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={pending || !(draft.name ?? "").trim()}
                        onClick={onAdd}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {rows.length === 0 && !def.create && (
                <tr>
                  <td
                    colSpan={def.metaLabel ? 2 : 1}
                    className="px-4 py-10 text-center text-muted"
                  >
                    Nothing here yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
