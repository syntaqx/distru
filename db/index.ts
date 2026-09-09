import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Runtime uses the POOLED connection. Accept the Neon/Vercel Postgres
// integration's `POSTGRES_URL` as a fallback so no manual `DATABASE_URL` is
// needed when that integration is wired in.
const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "postgres://distru:distru@localhost:5432/distru";

/**
 * A single postgres.js client, reused across hot reloads / serverless
 * invocations. postgres.js pools internally and works both locally and against
 * a pooled Neon / Vercel Postgres connection string.
 */
const globalForDb = globalThis as unknown as {
  __distruPg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__distruPg ??
  // `onnotice` is silenced so routine NOTICEs (e.g. TRUNCATE ... CASCADE during
  // the staging reset) don't flood the logs.
  postgres(connectionString, { max: 10, prepare: false, onnotice: () => {} });

if (process.env.NODE_ENV !== "production") globalForDb.__distruPg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
export type DB = typeof db;
