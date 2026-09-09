/**
 * Seed the auto-filled demo tenant:
 *   - global unit types
 *   - a demo org "Green Leaf Collective"
 *   - a demo login: demo@distru.test / distru1234
 *   - a realistic starter catalog + inventory
 *
 * Run: npm run db:seed  (Postgres must be up: docker compose up -d)
 */
// In Docker, compose sets DATABASE_URL (+ env_file); only load .env on the host,
// and never let it override an already-set DATABASE_URL.
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env optional; falls back to defaults / real env.
  }
}

import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { db } from "@/db";
import { member, organization, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { provisionOrgSampleData } from "@/lib/seed-data";

const DEMO_EMAIL = "demo@distru.test";
const DEMO_PASSWORD = "distru1234";
const DEMO_ORG_NAME = "Green Leaf Collective";
const DEMO_ORG_SLUG = "green-leaf-collective";

async function ensureDemoUser(): Promise<string> {
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);
  if (existing) return existing.id;

  await auth.api.signUpEmail({
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD, name: "Demo Operator" },
  });
  const [created] = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);
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
  const existing = await db
    .select()
    .from(member)
    .where(eq(member.userId, userId));
  if (existing.some((m) => m.organizationId === orgId)) return;
  await db.insert(member).values({ organizationId: orgId, userId, role: "owner" });
}

async function main() {
  console.log("Seeding demo tenant...");
  const userId = await ensureDemoUser();
  const orgId = await ensureDemoOrg();
  await ensureMembership(orgId, userId);
  await provisionOrgSampleData(orgId);
  console.log("\nDone.");
  console.log(`  Org:   ${DEMO_ORG_NAME}`);
  console.log(`  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
