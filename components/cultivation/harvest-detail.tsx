"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Pencil } from "lucide-react";
import { packageHarvestAction } from "@/app/(app)/cultivation/actions";
import { Select } from "@/components/ui/select";

type HarvestStatus = "ACTIVE" | "FINISHED";
export type Option = { id: string; name: string };

export type HarvestDetailData = {
  id: string;
  harvestNumber: string;
  name: string | null;
  strainName: string | null;
  locationName: string | null;
  plantCount: number;
  wetWeight: number | null;
  dryWeight: number | null;
  status: HarvestStatus;
  harvestedDate: string | null;
};

const dateOf = (s: string | null) => (s ? new Date(s).toLocaleDateString() : "-");

export function HarvestDetail({
  harvest,
  products,
  locations,
}: {
  harvest: HarvestDetailData;
  products: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [qty, setQty] = useState<string>(
    harvest.dryWeight != null ? String(harvest.dryWeight) : "",
  );

  const finished = harvest.status === "FINISHED";

  function submit() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await packageHarvestAction({
        harvestId: harvest.id,
        productId,
        locationId,
        quantity: qty ? Number(qty) : undefined,
      });
      if (res.ok) {
        setOk(`Packaged as ${res.packageTag} (lot ${res.lotNumber}).`);
        router.refresh();
      } else setError(res.error ?? "Could not package harvest.");
    });
  }

  const label = "mb-1 block text-xs font-medium text-muted";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/cultivation" className="btn btn-ghost">
          <ArrowLeft size={16} /> Cultivation
        </Link>
        <div className="min-w-0">
          <h1 className="font-mono text-lg font-semibold">{harvest.harvestNumber}</h1>
          <p className="text-sm text-muted">
            {harvest.name ?? "Harvest"} &middot; {harvest.strainName ?? "Unknown strain"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`badge text-[10px] ${finished ? "text-accent" : "text-info"}`}
          >
            {harvest.status}
          </span>
          <Link href={`/cultivation/harvests/${harvest.id}/edit`} className="btn btn-outline">
            <Pencil size={16} /> Edit
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Plants", String(harvest.plantCount)],
          ["Wet weight", harvest.wetWeight != null ? `${harvest.wetWeight} g` : "-"],
          ["Dry weight", harvest.dryWeight != null ? `${harvest.dryWeight} g` : "-"],
          ["Harvested", dateOf(harvest.harvestedDate)],
        ].map(([l, v]) => (
          <div key={l} className="card">
            <div className="text-xs uppercase tracking-wide text-muted">{l}</div>
            <div className="mt-1 text-sm font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="mb-3 flex items-center gap-2">
          <Package size={16} className="text-accent" />
          <h2 className="text-sm font-semibold">Create package from harvest</h2>
        </div>
        <p className="mb-4 text-sm text-muted">
          Record this harvest&rsquo;s dry weight into inventory as a costed package
          and lot. This closes the seed-to-sale loop and marks the harvest FINISHED.
        </p>

        {finished ? (
          <div className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-muted">
            This harvest is finished and has been packaged into inventory.
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
            {ok && (
              <div className="mb-3 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-accent">
                {ok}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={label}>Product</label>
                <Select
                  ariaLabel="Product"
                  value={productId}
                  onValueChange={setProductId}
                  placeholder="Choose product"
                  options={[
                    { value: "", label: "Choose product" },
                    ...products.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>
              <div>
                <label className={label}>Quantity (g)</label>
                <input
                  type="number"
                  className="input"
                  value={qty}
                  min={0}
                  step="0.01"
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Location</label>
                <Select
                  ariaLabel="Location"
                  value={locationId}
                  onValueChange={setLocationId}
                  placeholder="Choose location"
                  options={[
                    { value: "", label: "Choose location" },
                    ...locations.map((l) => ({ value: l.id, label: l.name })),
                  ]}
                />
              </div>
              <div className="flex items-end">
                <button
                  className="btn btn-primary w-full"
                  disabled={pending || !productId || !locationId}
                  onClick={submit}
                >
                  <Package size={16} /> {pending ? "Packaging…" : "Package"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
