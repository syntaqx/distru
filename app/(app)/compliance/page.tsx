import { getOrgContext } from "@/lib/session";
import {
  expiringLicenses,
  listLicenses,
  listLicenseTypes,
  listTestResults,
} from "@/lib/modules/compliance";
import { listProducts } from "@/lib/modules/catalog";
import { getMetrcProvider } from "@/lib/integrations";
import {
  ComplianceManager,
  type ExpiringLicenseRow,
  type LicenseRow,
  type TestResultRow,
  type MetrcPackageRow,
  type MetrcTransferRow,
  type MetrcTagRow,
  type MetrcStrainRow,
  type MetrcItemRow,
  type MetrcLabBatchRow,
} from "@/components/compliance/compliance-manager";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return v == null ? "" : String(v);
}
function nameOf(v: unknown): string {
  return str((v as { name?: unknown } | null)?.name ?? "");
}

/** A license is active when it has no expiry or expires in the future. */
function isActive(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() >= Date.now();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from now until `expiresAt` (never negative). */
function daysUntil(expiresAt: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS));
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
    expiring,
    packagesPage,
    transfersPage,
    tagsPage,
    strainsPage,
    itemsPage,
    labBatchesPage,
  ] = await Promise.all([
    listLicenses(service, { limit: 200 }),
    listLicenseTypes(service, { limit: 200 }),
    listTestResults(service, { limit: 200 }),
    listProducts(service, { limit: 200 }),
    expiringLicenses(service, 30),
    metrc.listPackages(service),
    metrc.listTransfers(service),
    metrc.listTags(service),
    metrc.listStrains(service),
    metrc.listItems(service),
    metrc.listLabTestBatches(service),
  ]);

  const typeName = new Map(typeItems.map((t) => [t.id, t.name]));
  const productName = new Map(productItems.map((p) => [p.product.id, p.product.name]));

  const licenses: LicenseRow[] = licenseItems.map((l) => ({
    id: l.id,
    licenseNumber: l.licenseNumber,
    typeName: l.licenseTypeId ? typeName.get(l.licenseTypeId) ?? null : null,
    name: l.name ?? null,
    state: l.state ?? null,
    ownScope: l.companyId ? "customer" : "own",
    expiresAt: l.expiresAt ? new Date(l.expiresAt).toISOString() : null,
    active: isActive(l.expiresAt),
  }));

  const expiringLicenseRows: ExpiringLicenseRow[] = expiring.map((l) => ({
    id: l.id,
    licenseNumber: l.licenseNumber,
    name: l.name ?? null,
    state: l.state ?? null,
    expiresAt: l.expiresAt ? new Date(l.expiresAt).toISOString() : null,
    daysLeft: l.expiresAt ? daysUntil(l.expiresAt) : 0,
  }));

  const testResults: TestResultRow[] = testItems.map((r) => ({
    id: r.id,
    product: r.productId ? productName.get(r.productId) ?? null : null,
    batch: r.metrcLabTestId ?? null,
    passed: r.passed ?? null,
    thc: r.thcPercentage != null ? Number(r.thcPercentage) : null,
    cbd: r.cbdPercentage != null ? Number(r.cbdPercentage) : null,
    packageLinked: r.packageId != null,
    testedAt: r.testedAt ? new Date(r.testedAt).toISOString() : null,
  }));

  const packages: MetrcPackageRow[] = packagesPage.data.map((p) => ({
    label: str(p.label),
    item: nameOf(p.item),
    category: str((p.item as { category_name?: unknown } | null)?.category_name ?? ""),
    quantity: str(p.quantity),
    unit: nameOf(p.unit_type),
    packagedDate: str(p.packaged_date),
    labState: str(p.lab_testing_state),
  }));

  const transfers: MetrcTransferRow[] = transfersPage.data.map((t) => ({
    manifest: str(t.manifest_number),
    direction: str(t.direction),
    type: str(t.shipment_type_name),
    shipper: str(t.shipper_name),
    order: (t.order as { order_number?: unknown } | null)?.order_number
      ? str((t.order as { order_number?: unknown }).order_number)
      : null,
    updated: str(t.updated_datetime).slice(0, 10),
  }));

  const tags: MetrcTagRow[] = tagsPage.data.map((t) => ({
    tag: str(t.tag),
    kind: str(t.kind),
    assigned: Boolean(t.is_assigned),
  }));

  const strains: MetrcStrainRow[] = strainsPage.data.map((s) => ({
    name: str(s.name),
    thc: str(s.thc_level),
    cbd: str(s.cbd_level),
    genetics: str(s.genetics),
  }));

  const metrcItems: MetrcItemRow[] = itemsPage.data.map((i) => ({
    name: str(i.name),
    category: str(i.category_name),
    quantityType: str(i.quantity_type),
  }));

  const labBatches: MetrcLabBatchRow[] = labBatchesPage.data.map((b) => ({
    name: str(b.name),
    required: Boolean(b.required),
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Compliance</h1>
        <p className="text-sm text-muted">
          State licenses, lab results (COAs), and the synced Metrc
          track-and-trace view.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <ComplianceManager
          licenses={licenses}
          expiringLicenses={expiringLicenseRows}
          testResults={testResults}
          providerId={metrc.id}
          packages={packages}
          transfers={transfers}
          tags={tags}
          strains={strains}
          items={metrcItems}
          labBatches={labBatches}
        />
      </div>
    </div>
  );
}
