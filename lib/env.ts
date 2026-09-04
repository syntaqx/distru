/** Centralized, typed access to environment configuration. */
export const env = {
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://distru:distru@localhost:5432/distru",
  betterAuthSecret:
    process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-please-0000000000000000",
  betterAuthUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
};

export const hasAnthropicKey = () => env.anthropicApiKey.length > 0;
