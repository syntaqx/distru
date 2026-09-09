import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getLicense, listLicenseTypes } from "@/lib/modules/compliance";
import { LicenseForm } from "@/components/compliance/license-form";

export const dynamic = "force-dynamic";

/** Format a Date as YYYY-MM-DD for a native date input. */
function toDateInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function EditLicensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const license = await getLicense(service, id);
  if (!license) notFound();

  const { items: types } = await listLicenseTypes(service, { limit: 200 });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <LicenseForm
          initial={{
            id: license.id,
            licenseNumber: license.licenseNumber,
            licenseTypeId: license.licenseTypeId ?? "",
            name: license.name ?? "",
            state: license.state ?? "",
            expiresAt: toDateInput(license.expiresAt),
          }}
          types={types.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </div>
  );
}
