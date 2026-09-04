import { Building2 } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { listCompanies } from "@/lib/services/reference";

export const dynamic = "force-dynamic";

const ROLE_STYLE: Record<string, string> = {
  CUSTOMER: "var(--color-info)",
  VENDOR: "var(--color-accent)",
  BRAND: "var(--color-warn)",
};

export default async function CompaniesPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const companies = await listCompanies(service);

  const count = (role: string) => companies.filter((c) => c.roles.includes(role)).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Companies</h1>
        <p className="text-sm text-muted">
          Your CRM - customers, vendors, distributors, and brands. Imported lists land here.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total", companies.length],
            ["Customers", count("CUSTOMER")],
            ["Vendors", count("VENDOR")],
            ["Brands", count("BRAND")],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
              <div className="mt-1 text-2xl font-semibold">{value}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Roles</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Building2 size={15} className="text-muted" />
                      {c.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex flex-wrap gap-1.5">
                      {c.roles.map((r) => (
                        <span key={r} className="badge" style={{ color: ROLE_STYLE[r] ?? undefined }}>
                          {r}
                        </span>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-muted">
                    No companies yet. Import a customer or vendor list from the Copilot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
