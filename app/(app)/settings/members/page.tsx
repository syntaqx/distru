import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member, user } from "@/db/schema";
import { getOrgContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const rows = await db
    .select({
      id: member.id,
      role: member.role,
      createdAt: member.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, ctx.orgId));

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">Members</h1>
          <p className="text-sm text-muted">People with access to this workspace.</p>
        </header>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted" style={{ background: "var(--color-surface)" }}>
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t" style={{ background: "var(--color-surface)" }}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted">{m.email}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="badge" style={{ color: "var(--color-accent)" }}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
