/**
 * Seed the auto-filled demo tenant:
 *   - global unit types
 *   - a demo org "Green Leaf Collective"
 *   - a demo login: demo@distru.test / distru1234
 *   - a realistic starter catalog + inventory, plus showcase reports/runs
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

import { seedDemoTenant, DEMO_EMAIL, DEMO_ORG_NAME, DEMO_PASSWORD } from "@/lib/seed-tenant";

async function main() {
  console.log("Seeding demo tenant...");
  await seedDemoTenant();
  console.log("\nDone.");
  console.log(`  Org:   ${DEMO_ORG_NAME}`);
  console.log(`  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
