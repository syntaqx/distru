import { getOrgContext } from "@/lib/session";
import { listLicenseTypes } from "@/lib/modules/compliance";
import { LicenseForm } from "@/components/compliance/license-form";

export const dynamic = "force-dynamic";

export default async function NewLicensePage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { items: types } = await listLicenseTypes(service, { limit: 200 });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <LicenseForm
          initial={{ licenseNumber: "", licenseTypeId: "", name: "", state: "", expiresAt: "" }}
          types={types.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </div>
  );
}
