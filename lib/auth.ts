import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { uuidv7 } from "uuidv7";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

/**
 * Better Auth server instance.
 *
 * - Drizzle adapter over Postgres.
 * - Email + password (no email verification in dev for a frictionless demo).
 * - Organization plugin = real multitenancy (orgs, members, invitations, and an
 *   active organization tracked on the session).
 * - UUIDv7 ids so auth + domain rows share one sortable UUID keyspace.
 */
export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Auto-activate the user's first organization on login, so returning
        // users (and the seeded demo tenant) land straight in their workspace.
        before: async (session) => {
          const [m] = await db
            .select()
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .limit(1);
          return {
            data: {
              ...session,
              activeOrganizationId:
                session.activeOrganizationId ?? m?.organizationId ?? null,
            },
          };
        },
      },
    },
  },
  plugins: [organization()],
});

export type Auth = typeof auth;
