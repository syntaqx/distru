import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getCategory } from "@/lib/modules/catalog";
import { CategoryForm } from "@/components/categories/category-form";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const category = await getCategory(service, id);
  if (!category) notFound();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <CategoryForm
          initial={{
            id: category.id,
            name: category.name,
            biotrackType: category.biotrackType ?? "",
          }}
        />
      </div>
    </div>
  );
}
