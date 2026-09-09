import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/modules/catalog";
import { TestResultForm } from "@/components/compliance/test-result-form";

export const dynamic = "force-dynamic";

export default async function NewTestResultPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { items } = await listProducts(service, { limit: 200 });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <TestResultForm
          initial={{ productId: "", passed: "", testedAt: "", notes: "" }}
          products={items.map((p) => ({ id: p.product.id, name: p.product.name }))}
        />
      </div>
    </div>
  );
}
