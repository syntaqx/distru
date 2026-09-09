import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { getProduct } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";

export const dynamic = "force-dynamic";

const money = (v: string | null) => (v == null ? "-" : `$${Number(v).toFixed(2)}`);
const pct = (v: string | null) => (v == null ? "-" : `${Number(v)}%`);

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const p = await getProduct(service, id);
  if (!p) notFound();
  const onHand = (await onHandByProduct(service)).get(id) ?? 0;

  const primary = p.images.find((i) => i.isPrimary) ?? p.images[0];
  const r = p.product;
  const facts: [string, string | null][] = [
    ["Category", p.category?.name ?? null],
    ["Subcategory", p.subcategory?.name ?? null],
    ["Vendor", p.vendor?.name ?? null],
    ["Brand", p.brand?.name ?? null],
    ["Strain", p.strain?.name ?? null],
    ["Product group", p.productGroup?.name ?? null],
    ["Unit type", p.unitType?.name ?? null],
    ["Tracking", r.inventoryTrackingMethod],
    ["UPC", r.upc ?? null],
    ["THC", pct(r.thcContent)],
    ["CBD", pct(r.cbdContent)],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="btn btn-ghost px-2" title="Back to inventory" aria-label="Back to inventory">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{r.name}</h1>
              {r.status === "ARCHIVED" && <span className="badge text-[10px] text-muted">Archived</span>}
              {r.isSample && <span className="badge text-[10px] text-warn">Sample</span>}
            </div>
            <p className="font-mono text-xs text-muted">{r.sku}</p>
          </div>
        </div>
        <Link href={`/inventory/${id}/edit`} className="btn btn-primary">
          <Pencil size={15} /> Edit
        </Link>
      </header>

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-3">
          {/* Images + on-hand */}
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-xl border bg-surface">
              {primary ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={primary.dataUrl} alt={r.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted">No image</div>
              )}
            </div>
            {p.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {p.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={img.id} src={img.dataUrl} alt="" className="aspect-square w-full rounded-lg border object-cover" />
                ))}
              </div>
            )}
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-muted">On hand</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{onHand.toLocaleString()}</div>
              <div className="mt-1 text-xs text-muted">{p.unitType?.name ?? "units"}</div>
            </div>
          </div>

          {/* Facts */}
          <div className="space-y-4 lg:col-span-2">
            <section className="card">
              <div className="mb-3 flex items-baseline gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted">Unit price</div>
                  <div className="text-2xl font-semibold">{money(r.unitPrice)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted">MSRP</div>
                  <div className="text-2xl font-semibold text-muted">{money(r.msrp)}</div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd>{v ?? "-"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {r.description && (
              <section className="card">
                <h2 className="mb-2 text-sm font-semibold">Description</h2>
                <p className="text-sm text-muted">{r.description}</p>
              </section>
            )}

            {p.images.length === 0 && (
              <p className="text-sm text-muted">
                No images yet.{" "}
                <Link href={`/inventory/${id}/edit`} className="text-info hover:underline">Add one</Link>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
