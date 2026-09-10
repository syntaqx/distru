import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getVehicle } from "@/lib/modules/logistics";
import { VehicleForm } from "@/components/fleet/vehicle-form";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const v = await getVehicle(service, id);
  if (!v) notFound();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <VehicleForm
          initial={{
            id: v.id,
            name: v.name,
            make: v.make ?? "",
            model: v.model ?? "",
            licensePlate: v.licensePlate ?? "",
          }}
        />
      </div>
    </div>
  );
}
