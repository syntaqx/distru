import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://distru:distru@localhost:5432/distru",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
