import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getDriver } from "@/lib/modules/logistics";
import { DriverForm } from "@/components/fleet/driver-form";

export const dynamic = "force-dynamic";

export default async function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const d = await getDriver(service, id);
  if (!d) notFound();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <DriverForm
          initial={{
            id: d.id,
            name: d.name,
            phone: d.phone ?? "",
            licenseNumber: d.licenseNumber ?? "",
          }}
        />
      </div>
    </div>
  );
}
