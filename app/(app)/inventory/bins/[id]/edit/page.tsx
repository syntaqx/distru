import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getBin } from "@/lib/modules/inventory";
import { listLocations } from "@/lib/modules/catalog";
import { BinForm } from "@/components/inventory/bin-form";

export const dynamic = "force-dynamic";

export default async function EditBinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;

  const bin = await getBin(service, id);
  if (!bin) notFound();

  const locations = await listLocations(service);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <BinForm
          initial={{
            id: bin.id,
            name: bin.name,
            locationId: bin.locationId ?? "",
          }}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
