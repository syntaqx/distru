import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { getAssembly, availableByProduct } from "@/lib/modules/manufacturing";
import { listProducts } from "@/lib/modules/catalog";
import { AssemblyRunActions } from "@/components/manufacturing/assembly-run-actions";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "var(--color-muted)",
  IN_PROGRESS: "var(--color-info)",
  COMPLETED: "var(--color-accent)",
  CANCELED: "var(--color-danger)",
};

const money = (n: number) => `$${n.toFixed(2)}`;
const dateTime = (d: Date | null) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

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

  // Availability = on-hand - reserved (this run's own active reservations are
  // included in "reserved", so add them back to judge whether *this* plan fits).
  const avail = await availableByProduct(service);
  const isPosted = assembly.inventoryPosted;
  const ownReservedByProduct = new Map<string, number>();
  for (const r of assembly.reservations) {
    if (r.status === "ACTIVE" && r.productId)
      ownReservedByProduct.set(
        r.productId,
        (ownReservedByProduct.get(r.productId) ?? 0) + Number(r.quantity),
      );
  }
  const inputRows = assembly.inputs.map((i) => {
    const a = i.productId ? avail.get(i.productId) : undefined;
    const need = Number(i.quantity);
    const onHand = a?.onHand ?? 0;
    const reserved = a?.reserved ?? 0;
    // Available to *this* run = on-hand minus everyone else's holds.
    const availableToPlan = onHand - (reserved - (ownReservedByProduct.get(i.productId ?? "") ?? 0));
    return { input: i, need, onHand, reserved, availableToPlan };
  });
  const shortfalls = isPosted
    ? []
    : inputRows.filter((r) => r.input.productId && r.need > r.availableToPlan);
  const isReserved = assembly.reservations.some((r) => r.status === "ACTIVE");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
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

      <div className="flex-1 overflow-auto p-4 sm:p-6">
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
                <div>
                  <dt className="text-xs text-muted">Inventory</dt>
                  <dd>
                    {assembly.inventoryPosted ? (
                      <span className="inline-flex items-center gap-1 text-accent">
                        <CheckCircle2 size={14} /> Posted
                      </span>
                    ) : (
                      <span className="text-muted">Not posted</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Reservation</dt>
                  <dd>
                    {isReserved ? (
                      <span className="inline-flex items-center gap-1 text-info">
                        <Lock size={14} /> Inputs reserved
                      </span>
                    ) : (
                      <span className="text-muted">No hold</span>
                    )}
                  </dd>
                </div>
                {dateTime(assembly.scheduledStart) && (
                  <div>
                    <dt className="text-xs text-muted">Scheduled start</dt>
                    <dd>{dateTime(assembly.scheduledStart)}</dd>
                  </div>
                )}
                {dateTime(assembly.scheduledEnd) && (
                  <div>
                    <dt className="text-xs text-muted">Scheduled end</dt>
                    <dd>{dateTime(assembly.scheduledEnd)}</dd>
                  </div>
                )}
                {assembly.estimatedWorkMinutes != null && (
                  <div>
                    <dt className="text-xs text-muted">Estimated work</dt>
                    <dd>{assembly.estimatedWorkMinutes} min</dd>
                  </div>
                )}
                {assembly.assignedTo && (
                  <div>
                    <dt className="text-xs text-muted">Assigned to</dt>
                    <dd>{assembly.assignedTo}</dd>
                  </div>
                )}
                {assembly.notes && (
                  <div>
                    <dt className="text-xs text-muted">Notes</dt>
                    <dd>{assembly.notes}</dd>
                  </div>
                )}
              </dl>
            </section>

            {assembly.status !== "COMPLETED" &&
              assembly.status !== "CANCELED" && (
                <section className="card">
                  <h2 className="mb-3 text-sm font-semibold">Run</h2>
                  {shortfalls.length > 0 && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        {shortfalls.length} input(s) exceed available stock
                        (on-hand minus reservations). Completing may fail on a
                        shortfall.
                      </span>
                    </div>
                  )}
                  <AssemblyRunActions id={assembly.id} status={assembly.status} />
                </section>
              )}

            {assembly.status === "COMPLETED" && assembly.inventoryPosted && (
              <section className="card">
                <div className="flex items-center gap-2 text-sm text-accent">
                  <CheckCircle2 size={16} /> Inventory posted
                </div>
                <p className="mt-1 text-xs text-muted">
                  Inputs were consumed and outputs produced at the rolled unit
                  cost shown below.
                </p>
              </section>
            )}
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
                        <th className="py-2 pr-4 text-right font-medium">Needed</th>
                        <th className="py-2 pr-4 text-right font-medium">On hand</th>
                        <th className="py-2 text-right font-medium">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputRows.map(({ input: i, need, onHand, availableToPlan }) => {
                        const short = !isPosted && i.productId && need > availableToPlan;
                        return (
                          <tr key={i.id} className="border-t">
                            <td className="py-2 pr-4">{nameFor(i.productId)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{need}</td>
                            <td className="py-2 pr-4 text-right tabular-nums text-muted">
                              {onHand}
                            </td>
                            <td
                              className={`py-2 text-right tabular-nums ${short ? "text-danger" : "text-muted"}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {short && <AlertTriangle size={12} />}
                                {availableToPlan}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!isPosted && (
                    <p className="mt-2 text-xs text-muted">
                      Available = on-hand minus stock reserved by other planned or
                      in-progress runs.
                    </p>
                  )}
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
                        <th className="py-2 pr-4 text-right font-medium">
                          Quantity
                        </th>
                        <th className="py-2 text-right font-medium">Unit cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assembly.outputs.map((o) => (
                        <tr key={o.id} className="border-t">
                          <td className="py-2 pr-4">{nameFor(o.productId)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {Number(o.quantity)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted">
                            {o.unitCost != null
                              ? money(Number(o.unitCost))
                              : "-"}
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
