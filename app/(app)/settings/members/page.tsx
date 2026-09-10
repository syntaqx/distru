import { getOrgContext } from "@/lib/session";
import { listTeam } from "@/lib/modules/platform";
import { MembersManager } from "@/components/settings/members-manager";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const team = await listTeam(ctx);

  const rows = team.map((m) => ({
    memberId: m.memberId,
    userId: m.userId,
    name: m.name,
    email: m.email,
    image: m.image,
    roles: m.roles,
    joinedAt: m.joinedAt.toISOString(),
    isDriver: !!m.driver,
  }));

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">People</h1>
          <p className="text-sm text-muted">
            Everyone with access to this workspace — their roles, and who’s a driver. A person can be
            an admin and a driver at the same time.
          </p>
        </header>
        <MembersManager rows={rows} />
      </div>
    </div>
  );
}
