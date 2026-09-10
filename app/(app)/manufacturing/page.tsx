import { getOrgContext } from "@/lib/session";
import {
  listAssemblies,
  getAssembly,
  listCosts,
  listCostTypes,
  availableByProduct,
} from "@/lib/modules/manufacturing";
import { listProducts } from "@/lib/modules/catalog";
import {
  ManufacturingManager,
  type AssemblyRow,
  type CostRow,
  type CostTypeRow,
} from "@/components/manufacturing/manufacturing-manager";

export const dynamic = "force-dynamic";

export default async function ManufacturingPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items: assemblyList }, { items: costList }, { items: costTypeList }, { items: products }] =
    await Promise.all([
      listAssemblies(service, { limit: 200 }),
      listCosts(service, { limit: 200 }),
      listCostTypes(service, { limit: 200 }),
      listProducts(service, { status: "ACTIVE", limit: 200 }),
    ]);

  const productName = new Map(products.map((p) => [p.product.id, p.product.name]));

  // Hydrate each assembly to resolve its output product + input count.
  const [hydrated, avail] = await Promise.all([
    Promise.all(assemblyList.map((a) => getAssembly(service, a.id))),
    availableByProduct(service),
  ]);

  const assemblyNumberById = new Map(assemblyList.map((a) => [a.id, a.assemblyNumber]));

  const assemblies: AssemblyRow[] = hydrated
    .filter((a) => a != null)
    .map((a) => {
      const outputId = a!.outputs[0]?.productId ?? null;
      // Does this run over-commit any input? Add back the run's own active
      // holds so a reserved in-progress run isn't flagged against itself.
      const ownReserved = new Map<string, number>();
      for (const r of a!.reservations)
        if (r.status === "ACTIVE" && r.productId)
          ownReserved.set(r.productId, (ownReserved.get(r.productId) ?? 0) + Number(r.quantity));
      const hasShortfall =
        !a!.inventoryPosted &&
        a!.inputs.some((i) => {
          if (!i.productId) return false;
          const info = avail.get(i.productId);
          const onHand = info?.onHand ?? 0;
          const reserved = info?.reserved ?? 0;
          const availableToPlan = onHand - (reserved - (ownReserved.get(i.productId) ?? 0));
          return Number(i.quantity) > availableToPlan;
        });
      return {
        id: a!.id,
        assemblyNumber: a!.assemblyNumber,
        outputProduct: outputId ? (productName.get(outputId) ?? null) : null,
        status: a!.status,
        inputCount: a!.inputs.length,
        createdAt: a!.createdAt.toISOString(),
        scheduledStart: a!.scheduledStart ? new Date(a!.scheduledStart).toISOString() : null,
        scheduledEnd: a!.scheduledEnd ? new Date(a!.scheduledEnd).toISOString() : null,
        estimatedWorkMinutes: a!.estimatedWorkMinutes ?? null,
        assignedTo: a!.assignedTo ?? null,
        isReserved: a!.reservations.some((r) => r.status === "ACTIVE"),
        hasShortfall,
      };
    });

  const costTypeName = new Map(costTypeList.map((ct) => [ct.id, ct.name]));
  const costCountByType = new Map<string, number>();
  for (const c of costList) {
    if (c.costTypeId)
      costCountByType.set(c.costTypeId, (costCountByType.get(c.costTypeId) ?? 0) + 1);
  }

  const costs: CostRow[] = costList.map((c) => ({
    id: c.id,
    assemblyNumber: c.assemblyId ? (assemblyNumberById.get(c.assemblyId) ?? null) : null,
    costType: c.costTypeId ? (costTypeName.get(c.costTypeId) ?? null) : null,
    description: c.description ?? null,
    amount: Number(c.amount),
  }));

  const costTypes: CostTypeRow[] = costTypeList.map((ct) => ({
    id: ct.id,
    name: ct.name,
    count: costCountByType.get(ct.id) ?? 0,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Manufacturing</h1>
        <p className="text-sm text-muted">
          Assemblies turn input inventory into finished products. Track their
          bill of materials and the costs applied to each run.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <ManufacturingManager
          assemblies={assemblies}
          costs={costs}
          costTypes={costTypes}
        />
      </div>
    </div>
  );
}
