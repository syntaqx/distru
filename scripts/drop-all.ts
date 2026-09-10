import postgres from "postgres";

/**
 * Drop and recreate the `public` schema, so the next `db:push` builds every
 * table fresh instead of trying to diff/rename an existing one.
 *
 * This demo's database is disposable - it is reseeded on every deploy and
 * nightly - so a clean rebuild is the simplest, most deterministic path, and it
 * sidesteps drizzle-kit's interactive "is this a rename?" prompt (which can't be
 * answered in CI / a non-TTY build). Prefers the direct/unpooled URL for DDL.
 */
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "postgres://distru:distru@localhost:5432/distru";

async function main() {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO current_user; GRANT ALL ON SCHEMA public TO public;",
    );
    console.log("✓ dropped and recreated the public schema");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
