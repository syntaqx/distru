import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getTestResult } from "@/lib/modules/compliance";
import { listProducts } from "@/lib/modules/catalog";
import { listPackages } from "@/lib/modules/inventory";
import { TestResultForm } from "@/components/compliance/test-result-form";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const str = (v: string | null) => (v == null ? "" : String(Number(v)));

export default async function EditTestResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const [coa, { items }, { items: pkgs }] = await Promise.all([
    getTestResult(service, id),
    listProducts(service, { limit: 200 }),
    listPackages(service, { limit: 200 }),
  ]);
  if (!coa) notFound();

  const notes =
    coa.results && typeof coa.results === "object" && "notes" in coa.results
      ? String((coa.results as { notes?: unknown }).notes ?? "")
      : "";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <TestResultForm
          initial={{
            id: coa.id,
            productId: coa.productId ?? "",
            packageId: coa.packageId ?? "",
            passed: coa.passed ?? "",
            testedAt: iso(coa.testedAt),
            coaUrl: coa.coaUrl ?? "",
            metrcLabTestId: coa.metrcLabTestId ?? "",
            thcPercentage: str(coa.thcPercentage),
            cbdPercentage: str(coa.cbdPercentage),
            thcMgPerUnit: str(coa.thcMgPerUnit),
            cbdMgPerUnit: str(coa.cbdMgPerUnit),
            notes,
          }}
          products={items.map((p) => ({ id: p.product.id, name: p.product.name }))}
          packages={pkgs.map((p) => ({ id: p.id, name: p.packageTag }))}
        />
      </div>
    </div>
  );
}
