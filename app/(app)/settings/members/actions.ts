"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireOrgContext } from "@/lib/session";
import type { ServiceCtx } from "@/lib/modules/shared";
import {
  ensureDriverProfile,
  getTeamMember,
  removeDriverProfile,
  removeMember,
  updateMemberRoles,
  upsertMembership,
} from "@/lib/modules/platform";

async function svc(): Promise<ServiceCtx> {
  const ctx = await requireOrgContext();
  return { orgId: ctx.orgId, actor: ctx.actor, actorType: "user" };
}

type Result = { ok: boolean; error?: string };

/**
 * Find an existing login by email, or create a real better-auth user (same path
 * the demo seed uses) so an invited person can sign into the app / driver app.
 * Runtime provisioning of a working password (invite email) is the mocked step;
 * the account row itself is real.
 */
async function findOrCreateUser(email: string, name: string): Promise<string> {
  const clean = email.trim().toLowerCase();
  const [existing] = await db.select().from(user).where(eq(user.email, clean)).limit(1);
  if (existing) return existing.id;
  await auth.api.signUpEmail({
    body: { email: clean, password: randomUUID(), name: name.trim() },
  });
  const [created] = await db.select().from(user).where(eq(user.email, clean)).limit(1);
  if (!created) throw new Error("Could not create the account.");
  return created.id;
}

export type InviteMemberForm = {
  name: string;
  email: string;
  roles: string[];
  driver?: { phone?: string | null; licenseNumber?: string | null } | null;
};

export async function inviteMemberAction(form: InviteMemberForm): Promise<Result & { id?: string }> {
  if (!form.name?.trim()) return { ok: false, error: "Name is required." };
  if (!form.email?.trim() || !form.email.includes("@")) {
    return { ok: false, error: "A valid email is required." };
  }
  const service = await svc();
  try {
    const userId = await findOrCreateUser(form.email, form.name);
    const { memberId } = await upsertMembership(service, { userId, roles: form.roles });
    if (form.driver) {
      await ensureDriverProfile(service, {
        userId,
        name: form.name.trim(),
        phone: form.driver.phone ?? null,
        licenseNumber: form.driver.licenseNumber ?? null,
      });
    }
    revalidatePath("/settings/members");
    return { ok: true, id: memberId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add the member." };
  }
}

export async function updateMemberRolesAction(
  memberId: string,
  roles: string[],
): Promise<Result> {
  const service = await svc();
  try {
    await updateMemberRoles(service, memberId, roles);
    revalidatePath("/settings/members");
    revalidatePath(`/settings/members/${memberId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update roles." };
  }
}

export async function setDriverProfileAction(
  memberId: string,
  profile: { phone?: string | null; licenseNumber?: string | null },
): Promise<Result> {
  const service = await svc();
  try {
    const m = await getTeamMember(service, memberId);
    if (!m) return { ok: false, error: "Member not found." };
    await ensureDriverProfile(service, {
      userId: m.userId,
      name: m.name,
      phone: profile.phone ?? null,
      licenseNumber: profile.licenseNumber ?? null,
    });
    revalidatePath("/settings/members");
    revalidatePath(`/settings/members/${memberId}`);
    revalidatePath("/fleet");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save driver profile." };
  }
}

export async function removeDriverProfileAction(memberId: string): Promise<Result> {
  const service = await svc();
  try {
    const m = await getTeamMember(service, memberId);
    if (!m) return { ok: false, error: "Member not found." };
    await removeDriverProfile(service, m.userId);
    revalidatePath("/settings/members");
    revalidatePath(`/settings/members/${memberId}`);
    revalidatePath("/fleet");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove driver profile." };
  }
}

export async function removeMemberAction(memberId: string): Promise<Result> {
  const service = await svc();
  try {
    await removeMember(service, memberId);
    revalidatePath("/settings/members");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove member." };
  }
}
