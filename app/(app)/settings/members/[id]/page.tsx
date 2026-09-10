import { notFound } from "next/navigation";
import { getOrgContext } from "@/lib/session";
import { getTeamMember } from "@/lib/modules/platform";
import { MemberDetail } from "@/components/settings/member-detail";

export const dynamic = "force-dynamic";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const m = await getTeamMember(ctx, id);
  if (!m) notFound();

  return (
    <div className="h-full overflow-auto">
      <MemberDetail
        data={{
          memberId: m.memberId,
          userId: m.userId,
          name: m.name,
          email: m.email,
          roles: m.roles,
          joinedAt: m.joinedAt.toISOString(),
          driver: m.driver,
          driverStats: m.driverStats,
        }}
      />
    </div>
  );
}
