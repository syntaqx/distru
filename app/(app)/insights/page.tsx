import {
  BarChart3,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { listReportDefs } from "@/lib/modules/reports";
import { ReportRow } from "@/components/insights/report-row";
import {
  salesSummary,
  topProducts,
  topCustomers,
  openInvoices,
  type Period,
} from "@/lib/modules/sales";
import { onHandByProduct } from "@/lib/modules/inventory";
import { listProducts } from "@/lib/modules/catalog";
import { PeriodTabs } from "@/components/insights/period-tabs";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const PERIODS: Period[] = ["7d", "30d", "90d", "12m", "ytd", "all"];

const PERIOD_LABEL: Record<Period, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
  "12m": "last 12 months",
  ytd: "year to date",
  all: "all time",
};

/**
 * The Available-reports list is derived from the report registry (the single
 * source of truth that also powers the `/public/v1/reports/*` API and the
 * `generate_report` tool), grouped in registry order.
 */
const REPORTS: { group: string; items: { name: string; label: string }[] }[] = (() => {
  const groups: { group: string; items: { name: string; label: string }[] }[] = [];
  for (const def of listReportDefs()) {
    let g = groups.find((x) => x.group === def.group);
    if (!g) {
      g = { group: def.group, items: [] };
      groups.push(g);
    }
    g.items.push({ name: def.name, label: def.label });
  }
  return groups;
})();

function Stat({
  label,
  value,
  Icon,
  sub,
}: {
  label: string;
  value: string | number;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  sub?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <Icon size={16} className="text-muted" />
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** A ranked horizontal-bar row, mirroring the Sales "Top sellers" list. */
function BarRow({
  rank,
  name,
  meta,
  fraction,
  amount,
  units,
}: {
  rank: number;
  name: string;
  meta?: string;
  fraction: number;
  amount: string;
  units?: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-4 text-right tabular-nums text-muted">{rank}</span>
      <span className="w-24 truncate sm:w-40" title={name}>
        {name}
      </span>
      {meta !== undefined && (
        <span className="hidden w-24 truncate font-mono text-xs text-muted sm:inline">{meta}</span>
      )}
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface2">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent/70"
          style={{ width: `${Math.max(4, fraction * 100)}%` }}
        />
      </div>
      {units !== undefined && (
        <span className="hidden w-16 text-right tabular-nums text-muted sm:inline">{units}</span>
      )}
      <span className="w-24 text-right font-medium tabular-nums">{amount}</span>
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const { period: periodParam } = await searchParams;
  const period: Period = PERIODS.includes(periodParam as Period)
    ? (periodParam as Period)
    : "all";

  const [summary, products, customers, open, onHand, { items: catalog }] =
    await Promise.all([
      salesSummary(service, { period }),
      topProducts(service, { period, limit: 8 }),
      topCustomers(service, { period, limit: 8 }),
      openInvoices(service, { limit: 200 }),
      onHandByProduct(service),
      listProducts(service, { limit: 200, status: "ACTIVE" }),
    ]);

  const activeProducts = catalog.length;

  // Inventory valuation: on-hand units x wholesale unit price, rolled up by
  // category. Only inventory-tracked ACTIVE products with a price contribute.
  const byCategory = new Map<string, { units: number; value: number }>();
  for (const p of catalog) {
    const units = onHand.get(p.product.id) ?? 0;
    const price = p.product.unitPrice ? Number(p.product.unitPrice) : 0;
    const cat = p.category?.name ?? "Uncategorized";
    const row = byCategory.get(cat) ?? { units: 0, value: 0 };
    row.units += units;
    row.value += units * price;
    byCategory.set(cat, row);
  }
  const valuation = [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.value - a.value);
  const grandUnits = valuation.reduce((a, r) => a + r.units, 0);
  const grandValue = valuation.reduce((a, r) => a + r.value, 0);

  const topProductRevenue = products[0]?.revenue || 1;
  const topCustomerRevenue = customers[0]?.revenue || 1;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Insights</h1>
          <p className="text-sm text-muted">
            Read-only reporting and analytics over sales, customers, and
            inventory - the same aggregates the Copilot and the Reports API see.
          </p>
        </div>
        <div className="sm:ml-auto">
          <PeriodTabs current={period} />
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Booked revenue"
            value={money(summary.revenue)}
            Icon={DollarSign}
            sub={PERIOD_LABEL[period]}
          />
          <Stat
            label="Orders"
            value={summary.orderCount.toLocaleString()}
            Icon={ShoppingCart}
            sub={`avg ${money(summary.averageOrderValue)}`}
          />
          <Stat
            label="Outstanding"
            value={money(open.totalOutstanding)}
            Icon={TrendingUp}
            sub={`${open.count} open invoice${open.count === 1 ? "" : "s"}`}
          />
          <Stat
            label="Active products"
            value={activeProducts.toLocaleString()}
            Icon={Package}
            sub={`${grandUnits.toLocaleString()} units on hand`}
          />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <TrendingUp size={14} /> Top products
            </div>
            <div className="space-y-1.5">
              {products.map((p, i) => (
                <BarRow
                  key={p.sku}
                  rank={i + 1}
                  name={p.name}
                  meta={p.sku}
                  fraction={p.revenue / topProductRevenue}
                  units={`${p.quantitySold.toLocaleString()} u`}
                  amount={money(p.revenue)}
                />
              ))}
              {products.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  No booked sales in this window.
                </p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <Users size={14} /> Top customers
            </div>
            <div className="space-y-1.5">
              {customers.map((c, i) => (
                <BarRow
                  key={c.customerId}
                  rank={i + 1}
                  name={c.name}
                  fraction={c.revenue / topCustomerRevenue}
                  units={`${c.orderCount.toLocaleString()} ord`}
                  amount={money(c.revenue)}
                />
              ))}
              {customers.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  No customers with booked sales in this window.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="card">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <BarChart3 size={14} /> Sales summary
            </div>
            <dl className="divide-y text-sm">
              {[
                ["Booked revenue", money(summary.revenue)],
                ["Units sold", summary.unitsSold.toLocaleString()],
                ["Orders", summary.orderCount.toLocaleString()],
                ["Average order value", money(summary.averageOrderValue)],
                ["Invoiced", money(summary.invoicedTotal)],
                ["Collected", money(summary.collected)],
                ["Outstanding (AR)", money(summary.outstanding)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-2"
                >
                  <dt className="text-muted">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
              <Package size={14} /> Inventory valuation
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">On hand</th>
                    <th className="pb-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {valuation.map((r) => (
                    <tr key={r.category} className="border-t">
                      <td className="py-1.5">{r.category}</td>
                      <td className="py-1.5 text-right tabular-nums text-muted">
                        {r.units.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {money(r.value)}
                      </td>
                    </tr>
                  ))}
                  {valuation.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-center text-muted"
                      >
                        No active inventory to value.
                      </td>
                    </tr>
                  )}
                </tbody>
                {valuation.length > 0 && (
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="pt-2">Total</td>
                      <td className="pt-2 text-right tabular-nums">
                        {grandUnits.toLocaleString()}
                      </td>
                      <td className="pt-2 text-right tabular-nums">
                        {money(grandValue)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">
              On-hand units x wholesale unit price, rolled up by category.
            </p>
          </div>
        </div>

        <div className="card">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
            <BarChart3 size={14} /> Available reports
          </div>
          <p className="mb-4 text-xs text-muted">
            These are the same reports available over the API at{" "}
            <code className="font-mono">/public/v1/reports/*</code>. Open the live
            JSON, or <span className="font-medium">save a snapshot to Reports</span> (hover a row) to
            keep, download, or have an automation email it.
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REPORTS.map((group) => (
              <div key={group.group}>
                <div className="mb-2 text-xs font-semibold text-muted">
                  {group.group}
                </div>
                <ul className="space-y-1">
                  {group.items.map((r) => (
                    <ReportRow key={r.name} name={r.name} label={r.label} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
