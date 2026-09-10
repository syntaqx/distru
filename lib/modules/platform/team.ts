import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, drivers, member, user } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { orderRoles, parseRoles, serializeRoles } from "@/lib/roles";

/**
 * Team / people management. People in a workspace are better-auth `user` (login
 * identity) + `member` (org membership with roles). A person can hold several
 * roles at once - they're additive labels, not a single tier - stored as a
 * comma-separated list in `member.role` (the better-auth organization plugin's
 * own convention; the role vocabulary + helpers live in `lib/roles.ts` so client
 * components can share them). "Driver" is special: being a driver means having a
 * linked `drivers` profile (license/phone) that dispatch assigns and the driver
 * app signs into, so it's tracked by the profile rather than the role string.
 * The display roles a person shows are their access roles plus "driver" when a
 * profile exists.
 *
 * Roles are managed labels for now (assignable + shown everywhere); route/action
 * enforcement is a deliberate follow-up.
 */

export { ORG_ROLES, ASSIGNABLE_ROLES, roleLabel, parseRoles, serializeRoles } from "@/lib/roles";
export type { OrgRoleKey } from "@/lib/roles";

export type DriverProfile = {
  id: string;
  phone: string | null;
  licenseNumber: string | null;
};

export type TeamMember = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  /** Access roles + "driver" when a profile exists, ordered canonically. */
  roles: string[];
  joinedAt: Date;
  driver: DriverProfile | null;
};

function withDriverRole(accessRoles: string[], driver: DriverProfile | null): string[] {
  return orderRoles(driver ? [...accessRoles, "driver"] : accessRoles);
}

/** Everyone in the org, with roles + driver profile, ordered by name. */
export async function listTeam(ctx: ServiceCtx): Promise<TeamMember[]> {
  const rows = await db
    .select({
      memberId: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: member.role,
      joinedAt: member.createdAt,
      driverId: drivers.id,
      driverPhone: drivers.phone,
      driverLicense: drivers.licenseNumber,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(
      drivers,
      and(eq(drivers.userId, member.userId), eq(drivers.organizationId, ctx.orgId)),
    )
    .where(eq(member.organizationId, ctx.orgId))
    .orderBy(asc(user.name));

  return rows.map((r) => {
    const driver: DriverProfile | null = r.driverId
      ? { id: r.driverId, phone: r.driverPhone, licenseNumber: r.driverLicense }
      : null;
    return {
      memberId: r.memberId,
      userId: r.userId,
      name: r.name,
      email: r.email,
      image: r.image,
      roles: withDriverRole(parseRoles(r.role), driver),
      joinedAt: r.joinedAt,
      driver,
    };
  });
}

export type TeamMemberDetail = TeamMember & {
  /** Delivery counters when this person is a driver (null otherwise). */
  driverStats: { total: number; delivered: number; active: number } | null;
};

export async function getTeamMember(
  ctx: ServiceCtx,
  memberId: string,
): Promise<TeamMemberDetail | null> {
  const [row] = await db
    .select({
      memberId: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: member.role,
      joinedAt: member.createdAt,
      driverId: drivers.id,
      driverPhone: drivers.phone,
      driverLicense: drivers.licenseNumber,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(
      drivers,
      and(eq(drivers.userId, member.userId), eq(drivers.organizationId, ctx.orgId)),
    )
    .where(and(eq(member.organizationId, ctx.orgId), eq(member.id, memberId)))
    .limit(1);
  if (!row) return null;

  const driver: DriverProfile | null = row.driverId
    ? { id: row.driverId, phone: row.driverPhone, licenseNumber: row.driverLicense }
    : null;

  let driverStats: TeamMemberDetail["driverStats"] = null;
  if (driver) {
    const [stats] = await db
      .select({
        total: count(),
        delivered: sql<number>`count(*) filter (where ${deliveries.status} = 'DELIVERED')`,
        active: sql<number>`count(*) filter (where ${deliveries.status} in ('ASSIGNED','OUT_FOR_DELIVERY'))`,
      })
      .from(deliveries)
      .where(and(eq(deliveries.organizationId, ctx.orgId), eq(deliveries.driverId, driver.id)));
    driverStats = {
      total: Number(stats?.total ?? 0),
      delivered: Number(stats?.delivered ?? 0),
      active: Number(stats?.active ?? 0),
    };
  }

  return {
    memberId: row.memberId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    image: row.image,
    roles: withDriverRole(parseRoles(row.role), driver),
    joinedAt: row.joinedAt,
    driver,
    driverStats,
  };
}

async function countOwners(orgId: string): Promise<number> {
  const rows = await db
    .select({ role: member.role })
    .from(member)
    .where(eq(member.organizationId, orgId));
  return rows.filter((r) => parseRoles(r.role).includes("owner")).length;
}

async function requireMember(ctx: ServiceCtx, memberId: string) {
  const [m] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, ctx.orgId), eq(member.id, memberId)))
    .limit(1);
  if (!m) throw new Error("Member not found.");
  return m;
}

/** Set a member's access roles (driver is managed via the profile, not here). */
export async function updateMemberRoles(
  ctx: ServiceCtx,
  memberId: string,
  roles: string[],
): Promise<void> {
  const m = await requireMember(ctx, memberId);
  const next = serializeRoles(roles);
  const wasOwner = parseRoles(m.role).includes("owner");
  const willBeOwner = parseRoles(next).includes("owner");
  if (wasOwner && !willBeOwner && (await countOwners(ctx.orgId)) <= 1) {
    throw new Error("This workspace needs at least one owner.");
  }
  await db
    .update(member)
    .set({ role: next })
    .where(and(eq(member.organizationId, ctx.orgId), eq(member.id, memberId)));
}

/** Create or update an org membership for an existing user (used by invite/seed). */
export async function upsertMembership(
  ctx: ServiceCtx,
  input: { userId: string; roles: string[] },
): Promise<{ memberId: string }> {
  const [existing] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, ctx.orgId), eq(member.userId, input.userId)))
    .limit(1);
  const role = serializeRoles(input.roles);
  if (existing) {
    await db.update(member).set({ role }).where(eq(member.id, existing.id));
    return { memberId: existing.id };
  }
  const [row] = await db
    .insert(member)
    .values({ organizationId: ctx.orgId, userId: input.userId, role })
    .returning();
  return { memberId: row.id };
}

export async function removeMember(ctx: ServiceCtx, memberId: string): Promise<void> {
  const m = await requireMember(ctx, memberId);
  if (parseRoles(m.role).includes("owner") && (await countOwners(ctx.orgId)) <= 1) {
    throw new Error("You can't remove the last owner.");
  }
  // Unlink (but keep) any driver profile so delivery history stays intact.
  await db
    .update(drivers)
    .set({ userId: null, updatedAt: new Date() })
    .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.userId, m.userId)));
  await db.delete(member).where(and(eq(member.organizationId, ctx.orgId), eq(member.id, memberId)));
}

/**
 * Make this person a driver (or update their profile). Reuses a same-named
 * account-less driver row if one exists (so seeded/manually-added drivers merge
 * into the person instead of duplicating), otherwise creates one.
 */
export async function ensureDriverProfile(
  ctx: ServiceCtx,
  input: { userId: string; name: string; phone?: string | null; licenseNumber?: string | null },
): Promise<{ driverId: string }> {
  const [byUser] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.userId, input.userId)))
    .limit(1);
  if (byUser) {
    await db
      .update(drivers)
      .set({
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber } : {}),
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, byUser.id));
    return { driverId: byUser.id };
  }
  // Adopt an existing account-less driver with the same name, if present.
  const [byName] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.name, input.name)))
    .limit(1);
  if (byName && !byName.userId) {
    await db
      .update(drivers)
      .set({
        userId: input.userId,
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber } : {}),
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, byName.id));
    return { driverId: byName.id };
  }
  const [row] = await db
    .insert(drivers)
    .values({
      organizationId: ctx.orgId,
      userId: input.userId,
      name: input.name,
      phone: input.phone ?? null,
      licenseNumber: input.licenseNumber ?? null,
    })
    .returning();
  return { driverId: row.id };
}

/**
 * Remove a person's driver status. Deletes the profile outright when it has no
 * delivery history; otherwise just unlinks it from the person (keeping the row
 * so past deliveries still resolve a driver name).
 */
export async function removeDriverProfile(ctx: ServiceCtx, userId: string): Promise<void> {
  const [d] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.organizationId, ctx.orgId), eq(drivers.userId, userId)))
    .limit(1);
  if (!d) return;
  const [{ value: used }] = await db
    .select({ value: count() })
    .from(deliveries)
    .where(and(eq(deliveries.organizationId, ctx.orgId), eq(deliveries.driverId, d.id)));
  if (Number(used) > 0) {
    await db.update(drivers).set({ userId: null, updatedAt: new Date() }).where(eq(drivers.id, d.id));
  } else {
    await db.delete(drivers).where(eq(drivers.id, d.id));
  }
}
