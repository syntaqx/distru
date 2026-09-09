import { getOrgContext } from "@/lib/session";
import { listCredits } from "@/lib/modules/sales";
import { listCompanies } from "@/lib/modules/catalog";
import { SalesSubnav } from "@/components/sales/sales-subnav";
import {
  CreditsManager,
  type CreditRowView,
} from "@/components/sales/credits-manager";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = {
    orgId: ctx.orgId,
    actor: ctx.actor,
    actorType: "user" as const,
  };

  const [{ items }, companies] = await Promise.all([
    listCredits(service, { limit: 200 }),
    listCompanies(service),
  ]);

  const nameById = new Map(companies.map((c) => [c.id, c.name]));
  const customers = companies
    .filter((c) => c.roles.includes("CUSTOMER"))
    .map((c) => c.name);

  const credits: CreditRowView[] = items.map((c) => ({
    id: c.id,
    customer: c.customerId ? nameById.get(c.customerId) ?? null : null,
    amount: Number(c.amount),
    remaining: Number(c.remaining),
    reason: c.reason ?? null,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Sales</h1>
        <p className="text-sm text-muted">
          Customer credits - store credit issued against returns or goodwill.
        </p>
      </header>
      <div className="flex-1 overflow-auto p-6">
        <SalesSubnav />
        <CreditsManager credits={credits} customers={customers} />
      </div>
    </div>
  );
}
