import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Pencil } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { getTestResult } from "@/lib/modules/compliance";
import { getProduct } from "@/lib/modules/catalog";
import { getPackage } from "@/lib/modules/inventory";

export const dynamic = "force-dynamic";

const PASS_BADGE: Record<string, string> = {
  PASS: "text-accent",
  FAIL: "text-danger",
  PENDING: "text-warn",
};

const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString() : "-");
const pct = (v: string | null) => (v == null ? "-" : `${Number(v)}%`);
const mg = (v: string | null) => (v == null ? "-" : `${Number(v)} mg`);

export default async function CoaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const coa = await getTestResult(service, id);
  if (!coa) notFound();

  const [product, pkg] = await Promise.all([
    coa.productId ? getProduct(service, coa.productId) : Promise.resolve(null),
    coa.packageId ? getPackage(service, coa.packageId) : Promise.resolve(null),
  ]);

  const notes =
    coa.results && typeof coa.results === "object" && "notes" in coa.results
      ? String((coa.results as { notes?: unknown }).notes ?? "")
      : "";

  const potency: [string, string][] = [
    ["THC", pct(coa.thcPercentage)],
    ["CBD", pct(coa.cbdPercentage)],
    ["THC per unit", mg(coa.thcMgPerUnit)],
    ["CBD per unit", mg(coa.cbdMgPerUnit)],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Link href="/compliance" className="btn btn-ghost">
              <ArrowLeft size={16} /> Compliance
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">
                {coa.name ?? "Certificate of Analysis"}
              </h1>
              <p className="text-sm text-muted">
                {product?.product.name ?? "No product"} &middot; tested{" "}
                {fmtDate(coa.testedAt)}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span
                className={`badge text-[11px] ${PASS_BADGE[coa.passed ?? ""] ?? "text-muted"}`}
              >
                {coa.passed ?? "NO RESULT"}
              </span>
              <a
                href={`/public/v1/test-results/${coa.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                <FileText size={16} /> PDF
              </a>
              <Link
                href={`/compliance/test-results/${coa.id}/edit`}
                className="btn btn-outline"
              >
                <Pencil size={16} /> Edit
              </Link>
            </div>
          </div>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Potency</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {potency.map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card mt-4">
            <h2 className="mb-3 text-sm font-semibold">Linkage</h2>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Product</dt>
                <dd className="mt-0.5">
                  {product ? `${product.product.name} (${product.product.sku})` : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Package (lot)</dt>
                <dd className="mt-0.5 font-mono text-xs">
                  {pkg ? pkg.packageTag : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Metrc lab test id</dt>
                <dd className="mt-0.5 font-mono text-xs">{coa.metrcLabTestId ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">COA document</dt>
                <dd className="mt-0.5">
                  {coa.coaUrl ? (
                    <a
                      href={coa.coaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info hover:underline"
                    >
                      Open document
                    </a>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
            </dl>
            {notes && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-muted">Notes</div>
                <p className="mt-1 text-sm">{notes}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
