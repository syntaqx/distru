import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Raw better-auth session (user + session record) for the current request. */
export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

export type OrgContext = {
  userId: string;
  user: SessionUser;
  orgId: string;
  /** Canonical actor string for audit + ledger, e.g. "user:<uuid>". */
  actor: string;
  /** Always "user" - makes OrgContext usable directly as a ServiceCtx. */
  actorType: "user";
};

/**
 * The tenant-scoped context every server action / API route builds on. Returns
 * null when the user is unauthenticated or has no active organization (which
 * routes the UI into sign-in / onboarding).
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const s = await getAuthSession();
  if (!s?.user) return null;
  const orgId = s.session.activeOrganizationId ?? null;
  if (!orgId) return null;
  return {
    userId: s.user.id,
    user: {
      id: s.user.id,
      name: s.user.name,
      email: s.user.email,
      image: s.user.image,
    },
    orgId,
    actor: `user:${s.user.id}`,
    actorType: "user",
  };
}

/** Like getOrgContext but throws - for API routes that must be authed. */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
