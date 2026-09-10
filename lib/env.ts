/** Centralized, typed access to environment configuration. */
export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    "postgres://distru:distru@localhost:5432/distru",
  betterAuthSecret:
    process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-please-0000000000000000",
  betterAuthUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicWorkspaceId: process.env.ANTHROPIC_WORKSPACE_ID ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
  // Shared secret guarding the scheduler tick endpoint (/api/workflows/tick).
  // When set, callers must present it as `Authorization: Bearer <secret>`.
  cronSecret: process.env.CRON_SECRET ?? "",
  // Opt-in flag that must be "1"/"true" to allow the DESTRUCTIVE nightly staging
  // reset (/api/staging/reset). Set only on the demo/staging deployment.
  enableStagingReset: /^(1|true)$/i.test(process.env.ENABLE_STAGING_RESET ?? ""),
  // Which model provider the harness talks to. The runner is provider-agnostic;
  // this picks the adapter (see lib/harness/providers). Default: anthropic.
  modelProvider: (process.env.MODEL_PROVIDER ?? "anthropic").toLowerCase(),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1",
  // External-integration providers (see lib/integrations). Each is provider-
  // agnostic: "mock" returns API-accurate synthetic data seeded from org data;
  // "none" behaves as unconnected (empty lists / null ids); a real adapter would
  // call the live service. Default "mock" so the Metrc/QuickBooks/LeafLink
  // surface is populated and faithful out of the box.
  metrcProvider: (process.env.METRC_PROVIDER ?? "mock").toLowerCase(),
  accountingProvider: (process.env.ACCOUNTING_PROVIDER ?? "mock").toLowerCase(),
  marketplaceProvider: (process.env.MARKETPLACE_PROVIDER ?? "mock").toLowerCase(),
  traceabilityProvider: (process.env.TRACEABILITY_PROVIDER ?? "mock").toLowerCase(),
  // Delivery providers - the outbound side (email a report, upload to Drive).
  // "mock" (default) simulates a connected account; "none" = unconnected.
  emailProvider: (process.env.EMAIL_PROVIDER ?? "mock").toLowerCase(),
  driveProvider: (process.env.DRIVE_PROVIDER ?? "mock").toLowerCase(),
  // Road-routing provider for the dispatch map (see lib/integrations/routing).
  //   "osrm"   (default) - real street geometry from the free, keyless OSRM demo
  //                        server; no credentials needed.
  //   "mapbox" - real geometry from Mapbox Directions (needs MAPBOX_TOKEN).
  //   "none"   - no road routing; the map draws straight depot->stop lines.
  // Env-selected exactly like the other integration seams, so a tenant can point
  // it at their own directions API without touching the callers.
  routingProvider: (process.env.ROUTING_PROVIDER ?? "osrm").toLowerCase(),
  routingBaseUrl: process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org",
  mapboxToken: process.env.MAPBOX_TOKEN ?? "",
};

export const hasAnthropicKey = () => env.anthropicApiKey.length > 0;
