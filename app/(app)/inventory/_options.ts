import type { ServiceCtx } from "@/lib/modules/shared";
import {
  listCategories,
  listCompanies,
  listProductGroups,
  listProductSubcategories,
  listStrains,
  listUnitTypes,
} from "@/lib/modules/catalog";

/** Reference lists that populate the product form's dropdowns. */
export async function loadProductFormOptions(service: ServiceCtx) {
  const [cats, companies, strains, subs, groups, units] = await Promise.all([
    listCategories(service),
    listCompanies(service),
    listStrains(service, { limit: 200 }),
    listProductSubcategories(service, { limit: 200 }),
    listProductGroups(service, { limit: 200 }),
    listUnitTypes(),
  ]);
  const named = (rows: { id: string; name: string }[]) => rows.map((r) => ({ id: r.id, name: r.name }));
  return {
    categories: cats.map((c) => c.name),
    vendors: companies.filter((c) => c.roles.includes("VENDOR")).map((c) => c.name),
    brands: companies.filter((c) => c.roles.includes("BRAND")).map((c) => c.name),
    strains: named(strains.items),
    subcategories: named(subs.items),
    groups: named(groups.items),
    unitTypes: named(units),
  };
}
