import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, IdCard, Pencil } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import {
  getCompany,
  getCompanyGroup,
  listCompanyNotes,
  listContacts,
} from "@/lib/modules/catalog";
import { listCompanyLicenses } from "@/lib/modules/compliance";
import { listInvoices, listOrders } from "@/lib/modules/sales";
import { listOrgMembers } from "@/lib/modules/platform";
import {
  CompanyTimeline,
  type TimelineEntry,
} from "@/components/companies/company-timeline";
import { ContactsPanel } from "@/components/companies/contacts-panel";

export const dynamic = "force-dynamic";

const ROLE_STYLE: Record<string, string> = {
  CUSTOMER: "var(--color-info)",
  VENDOR: "var(--color-accent)",
  BRAND: "var(--color-warn)",
};

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A license's display state, expiry-aware. Module-scoped so the render body stays pure. */
function licenseState(active: boolean, expiresAt: Date | null): { label: string; ok: boolean } {
  const expired = !!expiresAt && expiresAt.getTime() < Date.now();
  if (active && !expired) return { label: "Active", ok: true };
  return { label: expired ? "Expired" : "Inactive", ok: false };
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const c = await getCompany(service, id);
  if (!c) notFound();

  const [group, contactList, notes, licenses, orderList, invoiceList, members] =
    await Promise.all([
      c.groupId ? getCompanyGroup(service, c.groupId) : Promise.resolve(null),
      listContacts(service, { companyId: id, limit: 200 }),
      listCompanyNotes(service, id, { limit: 100 }),
      listCompanyLicenses(service, id),
      listOrders(service, { customerId: id, limit: 25 }),
      listInvoices(service, { customerId: id, limit: 50 }),
      listOrgMembers(service),
    ]);

  const contacts = contactList.items;
  // No explicit primary flag in the schema: the oldest contact is the primary one.
  const primaryContact = contacts.length ? contacts[contacts.length - 1] : null;
  const authorName = new Map(members.map((m) => [m.id, m.name]));

  // Outstanding balance: sum of remaining on non-voided, open invoices.
  const outstanding = invoiceList.items.reduce((sum, r) => {
    const inv = r.invoice;
    if (inv.voided) return sum;
    const remaining =
      Number(inv.total) - Number(inv.amountPaid) - Number(inv.creditsApplied);
    return remaining > 0 ? sum + remaining : sum;
  }, 0);

  // Merge notes, orders, and invoices into one newest-first activity timeline.
  const entries: TimelineEntry[] = [
    ...notes.map((n): TimelineEntry => ({
      kind: "note",
      id: n.id,
      at: n.createdAt.toISOString(),
      body: n.body,
      author: n.authorId ? authorName.get(n.authorId) ?? null : null,
    })),
    ...orderList.items.map((o): TimelineEntry => ({
      kind: "order",
      id: o.order.id,
      at: (o.order.orderDate ?? o.order.createdAt).toISOString(),
      label: `Order ${o.order.orderNumber}`,
      status: o.order.status,
      total: money(o.total),
      href: `/sales/orders/${o.order.orderNumber}`,
    })),
    ...invoiceList.items.map((r): TimelineEntry => {
      const inv = r.invoice;
      const balance =
        Number(inv.total) - Number(inv.amountPaid) - Number(inv.creditsApplied);
      return {
        kind: "invoice",
        id: inv.id,
        at: (inv.issueDate ?? inv.createdAt).toISOString(),
        label: `Invoice ${inv.invoiceNumber}`,
        status: inv.voided ? "VOIDED" : inv.status,
        total: money(Number(inv.total)),
        balance: money(Math.max(balance, 0)),
        href: `/sales/invoices/${inv.invoiceNumber}`,
      };
    }),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const facts: [string, string | null][] = [
    ["Relationship", c.roles.length ? c.roles.map((r) => r[0] + r.slice(1).toLowerCase()).join(", ") : null],
    ["Company group", group?.name ?? null],
    ["Primary contact", primaryContact ? primaryContact.name : null],
    ["Tags", c.tags?.length ? c.tags.join(", ") : null],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/companies" className="btn btn-ghost px-2" title="Back to companies" aria-label="Back to companies">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{c.name}</h1>
              {c.roles.map((role) => (
                <span key={role} className="badge" style={{ color: ROLE_STYLE[role] ?? undefined }}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Link href={`/companies/${id}/edit`} className="btn btn-primary">
          <Pencil size={15} /> Edit
        </Link>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold">Details</h2>
              <dl className="grid gap-y-2 text-sm">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd>{v ?? "-"}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-xs text-muted">Outstanding balance</dt>
                  <dd className={outstanding > 0 ? "font-semibold text-danger" : ""}>
                    ${money(outstanding)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="card">
              <div className="mb-3 flex items-center gap-2">
                <IdCard size={15} className="text-muted" />
                <h2 className="text-sm font-semibold">Licenses</h2>
              </div>
              {licenses.length === 0 ? (
                <p className="text-sm text-muted">No licenses on file.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {licenses.map((l) => {
                    const state = licenseState(l.active, l.expiresAt);
                    return (
                      <li key={l.id} className="border-t pt-2 first:border-t-0 first:pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{l.licenseNumber}</span>
                          <span className="badge" style={{ color: state.ok ? "var(--color-accent)" : "var(--color-danger)" }}>
                            {state.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {[l.name, l.state, l.expiresAt ? `expires ${l.expiresAt.toLocaleDateString()}` : null]
                            .filter(Boolean)
                            .join(" · ") || "-"}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <ContactsPanel
              companyId={id}
              primaryContactId={primaryContact?.id ?? null}
              contacts={contacts.map((ct) => ({
                id: ct.id,
                name: ct.name,
                title: ct.title ?? null,
                email: ct.email ?? null,
                phone: ct.phone ?? null,
              }))}
            />
          </div>

          <div className="space-y-4 lg:col-span-2">
            <CompanyTimeline companyId={id} entries={entries} />
          </div>
        </div>
      </div>
    </div>
  );
}
