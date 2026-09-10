import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/modules/catalog";
import { inventoryValueByProduct } from "@/lib/modules/inventory";
import { InventorySubnav } from "@/components/inventory/inventory-subnav";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;

export default async function ValuationPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const [{ items }, valuation] = await Promise.all([
    listProducts(service, { limit: 500 }),
    inventoryValueByProduct(service),
  ]);

  const rows = items
    .map((p) => {
      const v = valuation.get(p.product.id) ?? { qty: 0, value: 0 };
      return {
        id: p.product.id,
        name: p.product.name,
        sku: p.product.sku,
        qty: v.qty,
        value: v.value,
        unitCost: v.qty > 0 ? v.value / v.qty : 0,
      };
    })
    .filter((r) => r.qty !== 0 || r.value !== 0)
    .sort((a, b) => b.value - a.value);

  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const totalQty = rows.reduce((a, r) => a + r.qty, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-muted">
          On-hand valuation at cost - the FIFO value of open lots, per product.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <InventorySubnav />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Products valued", rows.length.toLocaleString()],
            ["On-hand quantity", totalQty.toLocaleString()],
            ["Total value at cost", money(totalValue)],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="text-xs uppercase tracking-wide text-muted">
                {label}
              </div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr
                className="text-left text-muted"
                style={{ background: "var(--color-surface)" }}
              >
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 text-right font-medium">On hand</th>
                <th className="px-4 py-2.5 text-right font-medium">Unit cost</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Value at cost
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">
                    {r.sku ?? "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.qty.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                    {money(r.unitCost)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(r.value)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    No valued inventory yet. Receive stock to open cost layers.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr
                  className="border-t font-semibold"
                  style={{ background: "var(--color-surface)" }}
                >
                  <td className="px-4 py-2.5" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {totalQty.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(totalValue)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
