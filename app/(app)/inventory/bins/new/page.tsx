import { getOrgContext } from "@/lib/session";
import { listLocations } from "@/lib/modules/catalog";
import { BinForm } from "@/components/inventory/bin-form";

export const dynamic = "force-dynamic";

export default async function NewBinPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };

  const locations = await listLocations(service);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <BinForm
          initial={{ name: "", locationId: "" }}
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
