import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://distru:distru@localhost:5432/distru";

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
  postgres(connectionString, { max: 10, prepare: false });

if (process.env.NODE_ENV !== "production") globalForDb.__distruPg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
export type DB = typeof db;
