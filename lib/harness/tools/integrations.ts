import { z } from "zod";
import { defineTool, type AgentContext } from "../tool";
import type { HarnessToolPreview } from "../types";
import {
  PROVIDER_CATALOG,
  configureProvider,
  connectProvider,
  disconnectProvider,
  isProviderKey,
  listConnections,
  providerMeta,
  runMockSync,
  type ProviderKey,
} from "@/lib/modules/platform";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "low",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

const providerKeys = PROVIDER_CATALOG.map((p) => p.key) as [ProviderKey, ...ProviderKey[]];
const providerArg = z
  .enum(providerKeys)
  .describe(`Integration provider key. One of: ${providerKeys.join(", ")}.`);

/** Resolve a provider argument, tolerating labels like "QuickBooks". */
function resolveProvider(input: string): ProviderKey | null {
  const raw = input.trim().toLowerCase();
  if (isProviderKey(raw)) return raw;
  const byLabel = PROVIDER_CATALOG.find(
    (p) => p.label.toLowerCase() === raw || p.key.replace(/_/g, " ") === raw,
  );
  return byLabel?.key ?? null;
}

export const listIntegrationsTool = defineTool({
  name: "list_integrations",
  description:
    "List the third-party integrations (QuickBooks, Metrc, LeafLink, BioTrack, " +
    "Onfleet, Email, Google Drive), each with its category, connection status, " +
    "and when it last synced. Read-only.",
  gate: "none",
  inputSchema: z.object({}),
  async execute(_input, ctx: AgentContext) {
    const connections = await listConnections(ctx.service);
    const connected = connections.filter((c) => c.status === "connected").length;
    return {
      ok: true,
      summary: `${connections.length} providers; ${connected} connected.`,
      data: {
        integrations: connections.map((c) => ({
          provider: c.key,
          label: c.label,
          category: c.category,
          status: c.status,
          configured: c.configured,
          required_config: c.configFields.filter((f) => f.required).map((f) => f.key),
          connected_at: c.connectedAt ? c.connectedAt.toISOString() : null,
          last_synced_at: c.lastSyncedAt ? c.lastSyncedAt.toISOString() : null,
        })),
      },
    };
  },
});

export const connectIntegrationTool = defineTool({
  name: "connect_integration",
  description:
    "Connect a third-party integration provider so it can sync. Accepts a " +
    "provider key (e.g. quickbooks, metrc, leaflink, biotrack, onfleet, email, " +
    "google_drive) or its label.",
  gate: "confirmation",
  inputSchema: z.object({ provider: providerArg }),
  async buildPreview(input) {
    const key = resolveProvider(input.provider);
    if (!key) return confirm("Connect integration", `Unknown provider "${input.provider}".`, []);
    const meta = PROVIDER_CATALOG.find((p) => p.key === key)!;
    return confirm("Connect integration", `Connect ${meta.label} (${meta.category}).`, [
      { label: "Provider", value: meta.label },
    ]);
  },
  async execute(input, ctx: AgentContext) {
    const key = resolveProvider(input.provider);
    if (!key) return { ok: false, summary: `Unknown provider "${input.provider}".` };
    const meta = PROVIDER_CATALOG.find((p) => p.key === key)!;
    try {
      await connectProvider(ctx.service, key);
      return { ok: true, summary: `Connected ${meta.label}.`, data: { provider: key, status: "connected" } };
    } catch (err) {
      // Not configured yet - surface the honest setup requirement.
      return { ok: false, summary: err instanceof Error ? err.message : "Connect failed." };
    }
  },
});

export const configureIntegrationTool = defineTool({
  name: "configure_integration",
  description:
    "Set up a third-party integration's credentials (e.g. QuickBooks realm id + " +
    "OAuth client id/secret, Metrc vendor/user keys, Onfleet API key). Pass the " +
    "provider key or label and a `config` object of field keys to values; once " +
    "every required field is present the provider connects automatically. Use " +
    "list_integrations to see each provider's required_config keys.",
  gate: "confirmation",
  inputSchema: z.object({
    provider: providerArg,
    config: z
      .record(z.string(), z.string())
      .describe("Field key -> value map for this provider's credentials/settings."),
  }),
  async buildPreview(input) {
    const key = resolveProvider(input.provider);
    if (!key) return confirm("Configure integration", `Unknown provider "${input.provider}".`, []);
    const meta = providerMeta(key);
    const keys = Object.keys(input.config ?? {});
    return confirm(
      "Configure integration",
      `Save credentials for ${meta.label} (${keys.length} field(s)).`,
      // Never echo secret values back in the preview.
      meta.configFields
        .filter((f) => f.key in (input.config ?? {}))
        .map((f) => ({ label: f.label, value: f.secret ? "••••••••" : String(input.config[f.key]) })),
      "medium",
    );
  },
  async execute(input, ctx: AgentContext) {
    const key = resolveProvider(input.provider);
    if (!key) return { ok: false, summary: `Unknown provider "${input.provider}".` };
    const meta = providerMeta(key);
    const { configured, missing } = await configureProvider(ctx.service, key, input.config ?? {});
    return {
      ok: true,
      summary: configured
        ? `${meta.label} is set up and connected.`
        : `Saved ${meta.label} config; still missing: ${missing.join(", ") || "required fields"}.`,
      data: { provider: key, configured, missing },
    };
  },
});

export const disconnectIntegrationTool = defineTool({
  name: "disconnect_integration",
  description:
    "Disconnect a third-party integration provider. It stops syncing until " +
    "reconnected. Accepts a provider key or its label.",
  gate: "confirmation",
  inputSchema: z.object({ provider: providerArg }),
  async buildPreview(input) {
    const key = resolveProvider(input.provider);
    if (!key) return confirm("Disconnect integration", `Unknown provider "${input.provider}".`, []);
    const meta = PROVIDER_CATALOG.find((p) => p.key === key)!;
    return confirm("Disconnect integration", `Disconnect ${meta.label}.`, [
      { label: "Provider", value: meta.label },
    ], "medium");
  },
  async execute(input, ctx: AgentContext) {
    const key = resolveProvider(input.provider);
    if (!key) return { ok: false, summary: `Unknown provider "${input.provider}".` };
    await disconnectProvider(ctx.service, key);
    const meta = PROVIDER_CATALOG.find((p) => p.key === key)!;
    return { ok: true, summary: `Disconnected ${meta.label}.`, data: { provider: key, status: "disconnected" } };
  },
});

export const syncIntegrationTool = defineTool({
  name: "sync_integration",
  description:
    "Run a sync for a connected integration. This pushes/pulls records against " +
    "the provider (using the org's real data), records sync events, stamps the " +
    "last-synced time, and posts a notification. Accepts a provider key or label.",
  gate: "confirmation",
  inputSchema: z.object({ provider: providerArg }),
  async buildPreview(input) {
    const key = resolveProvider(input.provider);
    if (!key) return confirm("Sync integration", `Unknown provider "${input.provider}".`, []);
    const meta = PROVIDER_CATALOG.find((p) => p.key === key)!;
    return confirm("Sync integration", `Sync ${meta.label}: ${meta.syncVerb.toLowerCase()}.`, [
      { label: "Provider", value: meta.label },
      { label: "Action", value: meta.syncVerb },
    ]);
  },
  async execute(input, ctx: AgentContext) {
    const key = resolveProvider(input.provider);
    if (!key) return { ok: false, summary: `Unknown provider "${input.provider}".` };
    try {
      const result = await runMockSync(ctx.service, key);
      return {
        ok: true,
        summary: result.summary,
        data: {
          provider: key,
          events: result.events.map((e) => ({
            direction: e.direction,
            entity_type: e.entityType,
            summary: e.summary,
            status: e.status,
          })),
        },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Sync failed." };
    }
  },
});

export const integrationTools = [
  listIntegrationsTool,
  configureIntegrationTool,
  connectIntegrationTool,
  disconnectIntegrationTool,
  syncIntegrationTool,
];
