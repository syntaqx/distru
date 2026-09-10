"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Plus, ShieldCheck } from "lucide-react";

export type LicenseRow = {
  id: string;
  licenseNumber: string;
  typeName: string | null;
  name: string | null;
  state: string | null;
  ownScope: "own" | "customer";
  expiresAt: string | null;
  active: boolean;
};

export type ExpiringLicenseRow = {
  id: string;
  licenseNumber: string;
  name: string | null;
  state: string | null;
  expiresAt: string | null;
  daysLeft: number;
};

export type TestResultRow = {
  id: string;
  product: string | null;
  batch: string | null;
  passed: string | null;
  thc: number | null;
  cbd: number | null;
  packageLinked: boolean;
  testedAt: string | null;
};

export type MetrcPackageRow = {
  label: string;
  item: string;
  category: string;
  quantity: string;
  unit: string;
  packagedDate: string;
  labState: string;
};

export type MetrcTransferRow = {
  manifest: string;
  direction: string;
  type: string;
  shipper: string;
  order: string | null;
  updated: string;
};

export type MetrcTagRow = {
  tag: string;
  kind: string;
  assigned: boolean;
};

export type MetrcStrainRow = {
  name: string;
  thc: string;
  cbd: string;
  genetics: string;
};

export type MetrcItemRow = {
  name: string;
  category: string;
  quantityType: string;
};

export type MetrcLabBatchRow = {
  name: string;
  required: boolean;
};

type Tab = "licenses" | "test-results" | "metrc";

const PASS_BADGE: Record<string, string> = {
  PASS: "text-accent",
  FAIL: "text-danger",
  PENDING: "text-warn",
};

const LAB_STATE_BADGE: Record<string, string> = {
  TestPassed: "text-accent",
  NotSubmitted: "text-muted",
  SubmittedForTesting: "text-warn",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString();
}

const thStyle = { background: "var(--color-surface)" };

export function ComplianceManager({
  licenses,
  expiringLicenses,
  testResults,
  providerId,
  packages,
  transfers,
  tags,
  strains,
  items,
  labBatches,
}: {
  licenses: LicenseRow[];
  expiringLicenses: ExpiringLicenseRow[];
  testResults: TestResultRow[];
  providerId: string;
  packages: MetrcPackageRow[];
  transfers: MetrcTransferRow[];
  tags: MetrcTagRow[];
  strains: MetrcStrainRow[];
  items: MetrcItemRow[];
  labBatches: MetrcLabBatchRow[];
}) {
  const [tab, setTab] = useState<Tab>("licenses");

  const activeLicenses = licenses.filter((l) => l.active).length;
  const assignedTags = tags.filter((t) => t.assigned);
  const availableTags = tags.filter((t) => !t.assigned);

  const TABS: { key: Tab; label: string }[] = [
    { key: "licenses", label: "Licenses" },
    { key: "test-results", label: "Test Results" },
    { key: "metrc", label: "Metrc" },
  ];

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Active licenses", activeLicenses],
          ["Expiring ≤30d", expiringLicenses.length],
          ["COAs on file", testResults.length],
          ["Metrc packages", packages.length],
        ].map(([label, value]) => (
          <div key={label} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {expiringLicenses.length > 0 && (
        <section className="mb-6 rounded-xl border border-warn/40 bg-warn/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-warn" />
            <h2 className="text-sm font-semibold">
              {expiringLicenses.length} license
              {expiringLicenses.length === 1 ? "" : "s"} expiring soon
            </h2>
          </div>
          <ul className="space-y-1.5">
            {expiringLicenses.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"
              >
                <span className="font-mono text-xs">{l.licenseNumber}</span>
                <span className="text-muted">{l.name ?? "-"}</span>
                {l.state && <span className="text-muted">{l.state}</span>}
                <span className="ml-auto tabular-nums text-warn">
                  {l.daysLeft} day{l.daysLeft === 1 ? "" : "s"} &middot;{" "}
                  {fmtDate(l.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5" style={thStyle}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === t.key ? "text-fg" : "text-muted hover:text-fg"
              }`}
              style={
                tab === t.key ? { background: "var(--color-surface2)" } : undefined
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "licenses" && (
          <Link href="/compliance/licenses/new" className="btn btn-primary ml-auto">
            <Plus size={16} /> New license
          </Link>
        )}
        {tab === "test-results" && (
          <Link
            href="/compliance/test-results/new"
            className="btn btn-primary ml-auto"
          >
            <Plus size={16} /> New COA
          </Link>
        )}
      </div>

      {tab === "licenses" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="text-left text-muted" style={thStyle}>
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Scope</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">State</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Expiry</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.id} className="border-t" style={thStyle}>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.licenseNumber}</td>
                  <td className="px-4 py-2.5">
                    <span className="badge text-[10px] text-muted">
                      {l.ownScope === "own" ? "OUR LICENSE" : "CUSTOMER"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{l.typeName ?? "-"}</td>
                  <td className="px-4 py-2.5">{l.name ?? "-"}</td>
                  <td className="px-4 py-2.5">{l.state ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`badge text-[10px] ${
                        l.active ? "text-accent" : "text-danger"
                      }`}
                    >
                      {l.active ? "ACTIVE" : "EXPIRED"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{fmtDate(l.expiresAt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <Link
                        href={`/compliance/licenses/${l.id}/edit`}
                        className="btn btn-ghost px-2 py-1"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {licenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted">
                    No licenses yet. Add your state license to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "test-results" && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="text-left text-muted" style={thStyle}>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Result</th>
                <th className="px-4 py-2.5 text-right font-medium">THC</th>
                <th className="px-4 py-2.5 text-right font-medium">CBD</th>
                <th className="px-4 py-2.5 font-medium">Lot COA</th>
                <th className="px-4 py-2.5 font-medium">Tested</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {testResults.map((r) => (
                <tr key={r.id} className="border-t" style={thStyle}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/compliance/test-results/${r.id}`}
                      className="text-info hover:underline"
                    >
                      {r.product ?? "COA"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`badge text-[10px] ${
                        PASS_BADGE[r.passed ?? ""] ?? "text-muted"
                      }`}
                    >
                      {r.passed ?? "-"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.thc != null ? `${r.thc}%` : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.cbd != null ? `${r.cbd}%` : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.packageLinked ? (
                      <span className="badge text-[10px] text-info">LINKED</span>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{fmtDate(r.testedAt)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/compliance/test-results/${r.id}`}
                        className="btn btn-ghost px-2 py-1"
                      >
                        View
                      </Link>
                      <a
                        href={`/public/v1/test-results/${r.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost px-2 py-1"
                        title="View COA PDF"
                      >
                        <FileText size={14} /> PDF
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {testResults.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No lab results yet. Record a COA for a product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "metrc" && (
        <div className="space-y-6">
          <div className="flex items-start gap-2 rounded-lg border border-info/40 bg-info/5 px-3 py-2 text-sm text-muted">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-info" />
            <p>
              Read-only view of synced Metrc track-and-trace state, served by the{" "}
              <span className="font-mono text-xs">{providerId}</span> provider
              (mock). Packages, transfers, tags, strains, items and required lab
              batches mirror the state regulator&rsquo;s system and cannot be
              edited here.
            </p>
          </div>

          <MetrcSection title="Packages" count={packages.length}>
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="text-left text-muted" style={thStyle}>
                  <th className="px-4 py-2.5 font-medium">Label</th>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 text-right font-medium">Quantity</th>
                  <th className="px-4 py-2.5 font-medium">Packaged</th>
                  <th className="px-4 py-2.5 font-medium">Lab state</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.label} className="border-t" style={thStyle}>
                    <td className="px-4 py-2.5 font-mono text-xs">{p.label}</td>
                    <td className="px-4 py-2.5">{p.item}</td>
                    <td className="px-4 py-2.5 text-muted">{p.category || "-"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.quantity}
                      {p.unit ? ` ${p.unit}` : ""}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">
                      {p.packagedDate || "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`badge text-[10px] ${
                          LAB_STATE_BADGE[p.labState] ?? "text-muted"
                        }`}
                      >
                        {p.labState}
                      </span>
                    </td>
                  </tr>
                ))}
                <Empty show={packages.length === 0} cols={6} label="No Metrc packages synced." />
              </tbody>
            </table>
          </MetrcSection>

          <MetrcSection title="Transfers" count={transfers.length}>
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="text-left text-muted" style={thStyle}>
                  <th className="px-4 py-2.5 font-medium">Manifest</th>
                  <th className="px-4 py-2.5 font-medium">Direction</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Shipper</th>
                  <th className="px-4 py-2.5 font-medium">Order</th>
                  <th className="px-4 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.manifest} className="border-t" style={thStyle}>
                    <td className="px-4 py-2.5 font-mono text-xs">{t.manifest}</td>
                    <td className="px-4 py-2.5">{t.direction}</td>
                    <td className="px-4 py-2.5 text-muted">{t.type || "-"}</td>
                    <td className="px-4 py-2.5">{t.shipper || "-"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{t.order ?? "-"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted">{t.updated || "-"}</td>
                  </tr>
                ))}
                <Empty show={transfers.length === 0} cols={6} label="No Metrc transfers synced." />
              </tbody>
            </table>
          </MetrcSection>

          <MetrcSection
            title="Tags"
            extra={`${availableTags.length} available · ${assignedTags.length} assigned`}
          >
            <table className="w-full min-w-160 text-sm">
              <thead>
                <tr className="text-left text-muted" style={thStyle}>
                  <th className="px-4 py-2.5 font-medium">Tag</th>
                  <th className="px-4 py-2.5 font-medium">Kind</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={t.tag} className="border-t" style={thStyle}>
                    <td className="px-4 py-2.5 font-mono text-xs">{t.tag}</td>
                    <td className="px-4 py-2.5">{t.kind}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`badge text-[10px] ${
                          t.assigned ? "text-info" : "text-muted"
                        }`}
                      >
                        {t.assigned ? "ASSIGNED" : "AVAILABLE"}
                      </span>
                    </td>
                  </tr>
                ))}
                <Empty show={tags.length === 0} cols={3} label="No Metrc tags synced." />
              </tbody>
            </table>
          </MetrcSection>

          <div className="grid gap-6 lg:grid-cols-2">
            <MetrcSection title="Strains" count={strains.length}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted" style={thStyle}>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 text-right font-medium">THC</th>
                    <th className="px-4 py-2.5 text-right font-medium">CBD</th>
                    <th className="px-4 py-2.5 font-medium">Genetics</th>
                  </tr>
                </thead>
                <tbody>
                  {strains.map((s) => (
                    <tr key={s.name} className="border-t" style={thStyle}>
                      <td className="px-4 py-2.5">{s.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.thc}%</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.cbd}%</td>
                      <td className="px-4 py-2.5 text-muted">{s.genetics}</td>
                    </tr>
                  ))}
                  <Empty show={strains.length === 0} cols={4} label="No strains synced." />
                </tbody>
              </table>
            </MetrcSection>

            <MetrcSection title="Items" count={items.length}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted" style={thStyle}>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 font-medium">Quantity type</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.name} className="border-t" style={thStyle}>
                      <td className="px-4 py-2.5">{i.name}</td>
                      <td className="px-4 py-2.5 text-muted">{i.category}</td>
                      <td className="px-4 py-2.5 text-muted">{i.quantityType}</td>
                    </tr>
                  ))}
                  <Empty show={items.length === 0} cols={3} label="No items synced." />
                </tbody>
              </table>
            </MetrcSection>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Required lab test batches</h2>
            <div className="flex flex-wrap gap-2">
              {labBatches.map((b) => (
                <span key={b.name} className="badge text-[11px] text-muted">
                  {b.name}
                </span>
              ))}
              {labBatches.length === 0 && (
                <span className="text-sm text-muted">No lab batches defined.</span>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetrcSection({
  title,
  count,
  extra,
  children,
}: {
  title: string;
  count?: number;
  extra?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">
        {title}
        {(count != null || extra) && (
          <span className="ml-2 text-xs font-normal text-muted">
            {extra ?? count}
          </span>
        )}
      </h2>
      <div className="overflow-x-auto rounded-xl border">{children}</div>
    </section>
  );
}

function Empty({ show, cols, label }: { show: boolean; cols: number; label: string }) {
  if (!show) return null;
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-muted">
        {label}
      </td>
    </tr>
  );
}
