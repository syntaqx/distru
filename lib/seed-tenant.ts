import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db";
import { member, organization, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { provisionOrgSampleData } from "@/lib/seed-data";

/**
 * The demo tenant: a fixed org + login, reused by `npm run db:seed` and the
 * staging reset endpoint. Kept here (not in a script) so both paths share one
 * implementation.
 */
export const DEMO_EMAIL = "demo@distru.test";
export const DEMO_PASSWORD = "distru1234";
export const DEMO_ORG_NAME = "Green Leaf Collective";
export const DEMO_ORG_SLUG = "green-leaf-collective";

async function ensureDemoUser(): Promise<string> {
  const [existing] = await db.select().from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
  if (existing) return existing.id;
  await auth.api.signUpEmail({
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo Operator" },
  });
  const [created] = await db.select().from(user).where(eq(user.email, DEMO_EMAIL)).limit(1);
  if (!created) throw new Error("Failed to create demo user");
  return created.id;
}

async function ensureDemoOrg(): Promise<string> {
  const [existing] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, DEMO_ORG_SLUG))
    .limit(1);
  if (existing) return existing.id;
  const [row] = await db
    .insert(organization)
    .values({ id: uuidv7(), name: DEMO_ORG_NAME, slug: DEMO_ORG_SLUG })
    .returning();
  return row.id;
}

async function ensureMembership(orgId: string, userId: string) {
  const existing = await db.select().from(member).where(eq(member.userId, userId));
  if (existing.some((m) => m.organizationId === orgId)) return;
  await db.insert(member).values({ organizationId: orgId, userId, role: "owner" });
}

/** Create (if missing) the demo user + org + membership, then seed sample data. */
export async function seedDemoTenant(): Promise<{ orgId: string; userId: string }> {
  const userId = await ensureDemoUser();
  const orgId = await ensureDemoOrg();
  await ensureMembership(orgId, userId);
  await provisionOrgSampleData(orgId);
  return { orgId, userId };
}

/**
 * Nuke every table in the `public` schema, then rebuild the demo tenant from
 * scratch. This is the nightly staging reset - destructive by design, so its
 * callers must be gated (CRON_SECRET + ENABLE_STAGING_RESET). Truncating CASCADE
 * clears auth rows too, so the demo user is recreated via better-auth.
 */
export async function resetAndReseed(): Promise<{ orgId: string; userId: string }> {
  await db.execute(sql`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);
  return seedDemoTenant();
}
