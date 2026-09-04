import { getOrgContext } from "@/lib/session";
import { listProducts } from "@/lib/services/products";
import { onHandByProduct } from "@/lib/services/inventory";
import { listCategories, listCompanies } from "@/lib/services/reference";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { q } = await searchParams;

  const [{ items }, onHand, cats, vendors] = await Promise.all([
    listProducts(service, { search: q, limit: 200 }),
    onHandByProduct(service),
    listCategories(service),
    listCompanies(service),
  ]);

  const totalUnits = [...onHand.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Inventory</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Your live product catalog. The Copilot and the public API write here in real time.
        </p>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Products" value={items.length} />
          <Stat label="Units on hand" value={totalUnits.toLocaleString()} />
          <Stat label="Categories" value={cats.length} />
          <Stat label="Vendors / Brands" value={vendors.length} />
        </div>

        <form className="mb-4" action="/inventory">
          <input
            className="input max-w-sm"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or SKU…"
          />
        </form>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--color-muted)]" style={{ background: "var(--color-surface)" }}>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Vendor / Brand</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
                <th className="px-4 py-2.5 font-medium text-right">Price</th>
                <th className="px-4 py-2.5 font-medium text-right">On hand</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.product.id} className="border-t" style={{ background: "var(--color-bg)" }}>
                  <td className="px-4 py-2.5 font-medium">{p.product.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-muted)]">{p.product.sku}</td>
                  <td className="px-4 py-2.5">{p.category?.name ?? "-"}</td>
                  <td className="px-4 py-2.5">{p.vendor?.name ?? "-"}</td>
                  <td className="px-4 py-2.5">{p.unitType?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p.product.unitPrice ? `$${Number(p.product.unitPrice).toFixed(2)}` : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {(onHand.get(p.product.id) ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="badge"
                      style={
                        p.product.status === "ACTIVE"
                          ? { color: "var(--color-accent)" }
                          : { color: "var(--color-muted)" }
                      }
                    >
                      {p.product.status}
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--color-muted)]">
                    No products yet. Ask the Copilot to add some, or upload a catalog CSV.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
