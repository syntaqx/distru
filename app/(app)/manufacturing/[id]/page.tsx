import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { getAssembly } from "@/lib/modules/manufacturing";
import { listProducts } from "@/lib/modules/catalog";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "var(--color-muted)",
  IN_PROGRESS: "var(--color-info)",
  COMPLETED: "var(--color-accent)",
  CANCELED: "var(--color-danger)",
};

const money = (n: number) => `$${n.toFixed(2)}`;

export default async function AssemblyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };
  const { id } = await params;

  const assembly = await getAssembly(service, id);
  if (!assembly) notFound();

  const { items: products } = await listProducts(service, { limit: 200 });
  const productName = new Map(products.map((p) => [p.product.id, p.product.name]));
  const nameFor = (pid: string | null) =>
    pid ? (productName.get(pid) ?? pid) : "-";

  const totalCost = assembly.costs.reduce((a, c) => a + Number(c.amount), 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/manufacturing"
            className="btn btn-ghost px-2"
            title="Back to manufacturing"
            aria-label="Back to manufacturing"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-lg font-semibold">
              {assembly.assemblyNumber}
            </h1>
            <span
              className="badge"
              style={{ color: STATUS_STYLE[assembly.status] ?? undefined }}
            >
              {assembly.status}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold">Details</h2>
              <dl className="grid gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Status</dt>
                  <dd>{assembly.status}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Inputs</dt>
                  <dd>{assembly.inputs.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Outputs</dt>
                  <dd>{assembly.outputs.length}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Total cost</dt>
                  <dd>{money(totalCost)}</dd>
                </div>
                {assembly.notes && (
                  <div>
                    <dt className="text-xs text-muted">Notes</dt>
                    <dd>{assembly.notes}</dd>
                  </div>
                )}
              </dl>
            </section>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold">Inputs</h2>
              {assembly.inputs.length === 0 ? (
                <p className="text-sm text-muted">No input lines.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-100 text-sm">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="py-2 pr-4 font-medium">Product</th>
                        <th className="py-2 text-right font-medium">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.inputs.map((i) => (
                        <tr key={i.id} className="border-t">
                          <td className="py-2 pr-4">{nameFor(i.productId)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {Number(i.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <h2 className="mb-3 text-sm font-semibold">Outputs</h2>
              {assembly.outputs.length === 0 ? (
                <p className="text-sm text-muted">No output lines.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-100 text-sm">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="py-2 pr-4 font-medium">Product</th>
                        <th className="py-2 text-right font-medium">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.outputs.map((o) => (
                        <tr key={o.id} className="border-t">
                          <td className="py-2 pr-4">{nameFor(o.productId)}</td>
                          <td className="py-2 text-right tabular-nums">
                            {Number(o.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {assembly.costs.length > 0 && (
              <section className="card">
                <h2 className="mb-3 text-sm font-semibold">Costs</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-100 text-sm">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="py-2 pr-4 font-medium">Description</th>
                        <th className="py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.costs.map((c) => (
                        <tr key={c.id} className="border-t">
                          <td className="py-2 pr-4">{c.description ?? "-"}</td>
                          <td className="py-2 text-right tabular-nums">
                            {money(Number(c.amount))}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t font-medium">
                        <td className="py-2 pr-4">Total</td>
                        <td className="py-2 text-right tabular-nums">
                          {money(totalCost)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
