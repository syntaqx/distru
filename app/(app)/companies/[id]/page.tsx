import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getOrgContext } from "@/lib/session";
import { getCompany, getCompanyGroup, listContacts } from "@/lib/modules/catalog";

export const dynamic = "force-dynamic";

const ROLE_STYLE: Record<string, string> = {
  CUSTOMER: "var(--color-info)",
  VENDOR: "var(--color-accent)",
  BRAND: "var(--color-warn)",
};

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const service = { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" as const };
  const { id } = await params;
  const c = await getCompany(service, id);
  if (!c) notFound();

  const [group, contactList] = await Promise.all([
    c.groupId ? getCompanyGroup(service, c.groupId) : Promise.resolve(null),
    listContacts(service, { companyId: id, limit: 200 }),
  ]);
  const contacts = contactList.items;

  const facts: [string, string | null][] = [
    ["Roles", c.roles.length ? c.roles.join(", ") : null],
    ["Company group", group?.name ?? null],
    ["Tags", c.tags?.length ? c.tags.join(", ") : null],
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/companies" className="btn btn-ghost px-2" title="Back to companies" aria-label="Back to companies">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
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

      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-3">
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
              </dl>
            </section>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <section className="card">
              <h2 className="mb-3 text-sm font-semibold">Contacts</h2>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted">No contacts linked to this company.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-140 text-sm">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="py-2 pr-4 font-medium">Name</th>
                        <th className="py-2 pr-4 font-medium">Title</th>
                        <th className="py-2 pr-4 font-medium">Email</th>
                        <th className="py-2 font-medium">Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((ct) => (
                        <tr key={ct.id} className="border-t">
                          <td className="py-2 pr-4 font-medium">{ct.name}</td>
                          <td className="py-2 pr-4">{ct.title ?? "-"}</td>
                          <td className="py-2 pr-4">{ct.email ?? "-"}</td>
                          <td className="py-2">{ct.phone ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
