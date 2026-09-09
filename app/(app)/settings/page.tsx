import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, organization } from "@/db/schema";
import { getOrgContext } from "@/lib/session";

export const dynamic = "force-dynamic";

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-sm ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
    </div>
  );
}

export default async function SettingsGeneralPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const [org] = await db.select().from(organization).where(eq(organization.id, ctx.orgId)).limit(1);
  const [{ value: members }] = await db
    .select({ value: count() })
    .from(member)
    .where(and(eq(member.organizationId, ctx.orgId)));

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">General</h1>
          <p className="text-sm text-muted">Workspace settings for {org?.name}.</p>
        </header>

        <div className="card mb-4 space-y-4">
          <Field label="Workspace name" value={org?.name ?? "-"} />
          <Field label="Slug" value={org?.slug ?? "-"} mono />
          <Field label="Workspace ID" value={org?.id ?? "-"} mono />
          <Field
            label="Created"
            value={org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : "-"}
          />
        </div>

        <Link href="/settings/members" className="card flex items-center justify-between transition-colors hover:border-accent">
          <div>
            <div className="font-medium">Members</div>
            <div className="text-sm text-muted">{members} member(s) in this workspace</div>
          </div>
          <span className="text-muted">→</span>
        </Link>
      </div>
    </div>
  );
}
