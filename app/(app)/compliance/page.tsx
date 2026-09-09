import { getOrgContext } from "@/lib/session";
import { listLicenses, listLicenseTypes, listTestResults } from "@/lib/modules/compliance";
import { listProducts } from "@/lib/modules/catalog";
import { getMetrcProvider } from "@/lib/integrations";
import {
  ComplianceManager,
  type LicenseRow,
  type TestResultRow,
  type MetrcPackageRow,
  type MetrcTransferRow,
  type MetrcTagRow,
} from "@/components/compliance/compliance-manager";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

/** A license is active when it has no expiry or expires in the future. */
function isActive(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() >= Date.now();
}

export default async function CompliancePage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const metrc = getMetrcProvider();
  const [
    { items: licenseItems },
    { items: typeItems },
    { items: testItems },
    { items: productItems },
    packagesPage,
    transfersPage,
    tagsPage,
  ] = await Promise.all([
    listLicenses(service, { limit: 200 }),
    listLicenseTypes(service, { limit: 200 }),
    listTestResults(service, { limit: 200 }),
    listProducts(service, { limit: 200 }),
    metrc.listPackages(service),
    metrc.listTransfers(service),
    metrc.listTags(service),
  ]);

  const typeName = new Map(typeItems.map((t) => [t.id, t.name]));
  const productName = new Map(productItems.map((p) => [p.product.id, p.product.name]));

  const licenses: LicenseRow[] = licenseItems.map((l) => ({
    id: l.id,
    licenseNumber: l.licenseNumber,
    typeName: l.licenseTypeId ? typeName.get(l.licenseTypeId) ?? null : null,
    name: l.name ?? null,
    state: l.state ?? null,
    expiresAt: l.expiresAt ? new Date(l.expiresAt).toISOString() : null,
    active: isActive(l.expiresAt),
  }));

  const testResults: TestResultRow[] = testItems.map((r) => ({
    id: r.id,
    product: r.productId ? productName.get(r.productId) ?? null : null,
    batch: r.metrcLabTestId ?? null,
    passed: r.passed ?? null,
    testedAt: r.testedAt ? new Date(r.testedAt).toISOString() : null,
  }));

  const packages: MetrcPackageRow[] = packagesPage.data.map((p) => ({
    label: str(p.label),
    item: str((p.item as { name?: unknown } | null)?.name ?? ""),
    quantity: str(p.quantity),
    labState: str(p.lab_testing_state),
  }));

  const transfers: MetrcTransferRow[] = transfersPage.data.map((t) => ({
    manifest: str(t.manifest_number),
    direction: str(t.direction),
    order: (t.order as { order_number?: unknown } | null)?.order_number
      ? str((t.order as { order_number?: unknown }).order_number)
      : null,
  }));

  const tags: MetrcTagRow[] = tagsPage.data.map((t) => ({
    tag: str(t.tag),
    kind: str(t.kind),
    assigned: Boolean(t.is_assigned),
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Compliance</h1>
        <p className="text-sm text-muted">
          State licenses, lab results (COAs), and the synced Metrc
          track-and-trace view.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <ComplianceManager
          licenses={licenses}
          testResults={testResults}
          packages={packages}
          transfers={transfers}
          tags={tags}
        />
      </div>
    </div>
  );
}
