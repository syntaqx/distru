import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/session";

export default async function Home() {
  const s = await getAuthSession();
  if (!s?.user) redirect("/login");
  if (!s.session.activeOrganizationId) redirect("/onboarding");
  redirect("/dashboard");
}
