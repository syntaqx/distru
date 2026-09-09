import { getOrgContext } from "@/lib/session";
import {
  listCompanyGroups,
  listLocations,
  listProductGroups,
  listProductSubcategories,
  listStrains,
  listTaxes,
  listUnitTypes,
} from "@/lib/modules/catalog";
import {
  listMenus,
  listPaymentMethods,
  listPaymentTerms,
  listPriceTiers,
} from "@/lib/modules/sales";
import { ReferenceView, type ReferenceData } from "@/components/settings/reference-view";

export const dynamic = "force-dynamic";

export default async function ReferenceSettingsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const [
    taxes,
    priceTiers,
    paymentTerms,
    paymentMethods,
    strains,
    subcategories,
    productGroups,
    companyGroups,
    menus,
    locations,
    unitTypes,
  ] = await Promise.all([
    listTaxes(ctx),
    listPriceTiers(ctx),
    listPaymentTerms(ctx),
    listPaymentMethods(ctx),
    listStrains(ctx),
    listProductSubcategories(ctx),
    listProductGroups(ctx),
    listCompanyGroups(ctx),
    listMenus(ctx),
    listLocations(ctx),
    listUnitTypes(),
  ]);

  const data: ReferenceData = {
    taxes: taxes.items.map((r) => ({ id: r.id, name: r.name, meta: r.rate })),
    priceTiers: priceTiers.items.map((r) => ({ id: r.id, name: r.name })),
    paymentTerms: paymentTerms.items.map((r) => ({ id: r.id, name: r.name, meta: r.netDays })),
    paymentMethods: paymentMethods.items.map((r) => ({ id: r.id, name: r.name })),
    strains: strains.items.map((r) => ({ id: r.id, name: r.name, meta: r.type })),
    subcategories: subcategories.items.map((r) => ({ id: r.id, name: r.name })),
    productGroups: productGroups.items.map((r) => ({ id: r.id, name: r.name })),
    companyGroups: companyGroups.map((r) => ({ id: r.id, name: r.name })),
    menus: menus.items.map((r) => ({ id: r.id, name: r.name })),
    locations: locations.map((r) => ({ id: r.id, name: r.name })),
    unitTypes: unitTypes.map((r) => ({ id: r.id, name: r.name })),
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">Reference data</h1>
          <p className="text-sm text-muted">
            Catalog and sales reference lists used across products, companies, and orders.
          </p>
        </header>

        <ReferenceView data={data} />
      </div>
    </div>
  );
}
