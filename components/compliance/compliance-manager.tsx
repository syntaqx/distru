"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Plus, ShieldCheck } from "lucide-react";

export type LicenseRow = {
  id: string;
  licenseNumber: string;
  typeName: string | null;
  name: string | null;
  state: string | null;
  expiresAt: string | null;
  active: boolean;
};

export type TestResultRow = {
  id: string;
  product: string | null;
  batch: string | null;
  passed: string | null;
  testedAt: string | null;
};

export type MetrcPackageRow = {
  label: string;
  item: string;
  quantity: string;
  labState: string;
};

export type MetrcTransferRow = {
  manifest: string;
  direction: string;
  order: string | null;
};

export type MetrcTagRow = {
  tag: string;
  kind: string;
  assigned: boolean;
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

export function ComplianceManager({
  licenses,
  testResults,
  packages,
  transfers,
  tags,
}: {
  licenses: LicenseRow[];
  testResults: TestResultRow[];
  packages: MetrcPackageRow[];
  transfers: MetrcTransferRow[];
  tags: MetrcTagRow[];
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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Active licenses", activeLicenses],
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

      <div className="mb-4 flex items-center gap-2">
        <div
          className="flex rounded-lg border p-0.5"
          style={{ background: "var(--color-surface)" }}
        >
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
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Number</th>
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
                <tr
                  key={l.id}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {l.licenseNumber}
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
                  <td className="px-4 py-2.5 tabular-nums">
                    {fmtDate(l.expiresAt)}
                  </td>
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
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
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
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">Batch</th>
                <th className="px-4 py-2.5 font-medium">Result</th>
                <th className="px-4 py-2.5 font-medium">Tested</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {testResults.map((r) => (
                <tr
                  key={r.id}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5">{r.product ?? "-"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {r.batch ?? "-"}
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
                  <td className="px-4 py-2.5 tabular-nums">
                    {fmtDate(r.testedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
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
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
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
              Read-only view of synced Metrc track-and-trace state (mock
              provider). Packages, transfers and RFID tags mirror the state
              regulator&rsquo;s system and cannot be edited here.
            </p>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Packages</h2>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr
                    className="text-left text-muted"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <th className="px-4 py-2.5 font-medium">Label</th>
                    <th className="px-4 py-2.5 font-medium">Item</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      Quantity
                    </th>
                    <th className="px-4 py-2.5 font-medium">Lab state</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((p) => (
                    <tr
                      key={p.label}
                      className="border-t"
                      style={{ background: "var(--color-surface)" }}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {p.label}
                      </td>
                      <td className="px-4 py-2.5">{p.item}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {p.quantity}
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
                  {packages.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted">
                        No Metrc packages synced.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Transfers</h2>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr
                    className="text-left text-muted"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <th className="px-4 py-2.5 font-medium">Manifest</th>
                    <th className="px-4 py-2.5 font-medium">Direction</th>
                    <th className="px-4 py-2.5 font-medium">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr
                      key={t.manifest}
                      className="border-t"
                      style={{ background: "var(--color-surface)" }}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {t.manifest}
                      </td>
                      <td className="px-4 py-2.5">{t.direction}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {t.order ?? "-"}
                      </td>
                    </tr>
                  ))}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted">
                        No Metrc transfers synced.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold">
              Tags
              <span className="ml-2 text-xs font-normal text-muted">
                {availableTags.length} available &middot; {assignedTags.length}{" "}
                assigned
              </span>
            </h2>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr
                    className="text-left text-muted"
                    style={{ background: "var(--color-surface)" }}
                  >
                    <th className="px-4 py-2.5 font-medium">Tag</th>
                    <th className="px-4 py-2.5 font-medium">Kind</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((t) => (
                    <tr
                      key={t.tag}
                      className="border-t"
                      style={{ background: "var(--color-surface)" }}
                    >
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
                  {tags.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted">
                        No Metrc tags synced.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
