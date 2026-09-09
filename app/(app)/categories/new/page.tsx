import { getOrgContext } from "@/lib/session";
import { CategoryForm } from "@/components/categories/category-form";

export const dynamic = "force-dynamic";

export default async function NewCategoryPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <CategoryForm initial={{ name: "", biotrackType: "" }} />
      </div>
    </div>
  );
}
