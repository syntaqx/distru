/**
 * Full purge + reseed of the demo tenant: TRUNCATE every public table, then
 * rebuild the demo org/login and its lived-in sample data from scratch. This is
 * what runs on every deploy (`vercel-build`) and nightly via the staging cron,
 * so the demo always shows the latest schema + a fresh, consistent state.
 *
 * Destructive by design - only point it at the demo database.
 *
 * Run: npm run db:reset  (Postgres must be up)
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

import { resetAndReseed, DEMO_EMAIL, DEMO_ORG_NAME, DEMO_PASSWORD } from "@/lib/seed-tenant";

async function main() {
  console.log("Purging + reseeding demo tenant...");
  await resetAndReseed();
  console.log("\nDone (full reset).");
  console.log(`  Org:   ${DEMO_ORG_NAME}`);
  console.log(`  Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
