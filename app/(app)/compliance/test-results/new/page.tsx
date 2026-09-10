import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/modules/catalog";
import { listPackages } from "@/lib/modules/inventory";
import { TestResultForm } from "@/components/compliance/test-result-form";

export const dynamic = "force-dynamic";

export default async function NewTestResultPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const [{ items }, { items: pkgs }] = await Promise.all([
    listProducts(service, { limit: 200 }),
    listPackages(service, { limit: 200 }),
  ]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <TestResultForm
          initial={{ productId: "", packageId: "", passed: "", testedAt: "", notes: "" }}
          products={items.map((p) => ({ id: p.product.id, name: p.product.name }))}
          packages={pkgs.map((p) => ({ id: p.id, name: p.packageTag }))}
        />
      </div>
    </div>
  );
}
