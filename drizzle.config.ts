import { defineConfig } from "drizzle-kit";

// Schema DDL (`db:push`) prefers a DIRECT/unpooled connection - pooled pgbouncer
// endpoints (Neon/Vercel Postgres) can reject the session-level statements a
// migration issues. Fall back through the Neon integration's var names, then the
// pooled URL, then local dev.
const ddlUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "postgres://distru:distru@localhost:5432/distru";

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: ddlUrl },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
