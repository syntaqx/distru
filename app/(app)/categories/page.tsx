import { getOrgContext } from "@/lib/session";
import {
  listCategories,
  productCountByCategory,
  uncategorizedProductCount,
} from "@/lib/modules/catalog";
import { CategoriesManager } from "@/components/categories/categories-manager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const [cats, counts, uncategorized] = await Promise.all([
    listCategories(service),
    productCountByCategory(service),
    uncategorizedProductCount(service),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Categories</h1>
        <p className="text-sm text-muted">
          Organize your catalog. Categories are also created automatically when you name one on a product.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <CategoriesManager
          uncategorizedCount={uncategorized}
          rows={cats.map((c) => ({
            id: c.id,
            name: c.name,
            biotrackType: c.biotrackType,
            productCount: counts.get(c.id) ?? 0,
          }))}
        />
      </div>
    </div>
  );
}
