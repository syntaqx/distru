import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";
import { getOrgContext } from "@/lib/session";
import { listDocs } from "@/lib/docs/content";
import { AppChrome } from "@/components/app-chrome";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/");

  const [org] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, ctx.orgId))
    .limit(1);

  return (
    <AppChrome
      orgName={org?.name ?? "Workspace"}
      userName={ctx.user.name}
      userEmail={ctx.user.email}
      docsNav={listDocs()}
    >
      {children}
    </AppChrome>
  );
}
