/**
 * Integrations service - the operator-facing "connect and manage third-party
 * systems" surface. It marries three things:
 *
 *  1. A static CATALOG of the providers Distru can talk to (QuickBooks, Metrc,
 *     LeafLink, BioTrack, Onfleet, Email, Google Drive), each with a category and
 *     a human blurb.
 *  2. Persisted connection state (`integration_connections`) - is this org
 *     connected, when did it connect, when did it last sync.
 *  3. A sync-event audit (`integration_sync_events`) - what a sync actually did.
 *
 * The actual data seam lives in `lib/integrations` (env-selected mock/real
 * adapters). `runMockSync` drives those adapters against the org's REAL data to
 * produce believable, deterministic sync events ("Pushed 12 invoices to
 * QuickBooks", "Pulled 30 packages from Metrc") - so a live adapter can drop in
 * later without any caller changing.
 *
 * Depends on: shared, catalog, sales, inventory, purchasing, notifications,
 * and lib/integrations (the provider seam).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { integrationConnections, integrationSyncEvents } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit } from "../shared";
import { createNotification } from "../notifications";
import { listInvoices } from "../sales";
import { listOrders } from "../sales";
import { listProducts, listCompanies } from "../catalog";
import { listPurchaseOrders } from "../purchasing";
import { getMetrcProvider } from "@/lib/integrations";
import { hasLiveAdapter, runLiveSync } from "@/lib/integrations/live";
import { isOAuthProvider } from "@/lib/integrations/oauth";

export type ConnectionRow = typeof integrationConnections.$inferSelect;
export type SyncEventRow = typeof integrationSyncEvents.$inferSelect;

export type ProviderKey =
  | "quickbooks"
  | "xero"
  | "sage"
  | "metrc"
  | "leaflink"
  | "biotrack"
  | "onfleet"
  | "email"
  | "google_drive";

/**
 * One credential/setting a provider needs before it can talk to the real
 * service. This is the *shape* only - values live in `integration_connections.
 * config`. `secret: true` fields (API keys, client secrets, passwords) are never
 * sent back to the browser in the clear; the UI shows a "saved" placeholder and
 * only overwrites when the operator types a new value.
 */
export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "select";
  required: boolean;
  secret?: boolean;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

export type ProviderMeta = {
  key: ProviderKey;
  label: string;
  category: string;
  blurb: string;
  /** What "Sync now" does, in plain language (shown as the button hint). */
  syncVerb: string;
  /**
   * How the docs describe wiring this up - shown at the top of the configure
   * dialog so an operator knows where their credentials come from.
   */
  setupHint: string;
  /** The credentials/settings required to actually connect this provider. */
  configFields: ConfigField[];
};

/** The providers Distru can connect to. Order = display order on the screen. */
export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    key: "quickbooks",
    label: "QuickBooks Online",
    category: "Accounting",
    blurb:
      "Keep customers, invoices, and payments in step with your books. Distru pushes new invoices and payments to QuickBooks and matches customers by name.",
    syncVerb: "Push invoices, payments, and customers",
    setupHint:
      "Create an app in the Intuit Developer portal, then paste its OAuth client id/secret and your company's realm id.",
    configFields: [
      {
        key: "environment",
        label: "Environment",
        type: "select",
        required: true,
        options: [
          { value: "production", label: "Production" },
          { value: "sandbox", label: "Sandbox" },
        ],
      },
      { key: "realmId", label: "Company (realm) ID", type: "text", required: true, placeholder: "4620816365…" },
      { key: "clientId", label: "OAuth client ID", type: "text", required: true },
      { key: "clientSecret", label: "OAuth client secret", type: "password", required: true, secret: true },
    ],
  },
  {
    key: "xero",
    label: "Xero",
    category: "Accounting",
    blurb:
      "Alternative to QuickBooks. Push invoices and payments into Xero and match contacts, for teams that run their books on Xero.",
    syncVerb: "Push invoices, payments, and contacts",
    setupHint:
      "Create a Custom Connection in the Xero developer portal and paste its client id/secret plus the tenant (organisation) id.",
    configFields: [
      { key: "clientId", label: "Client ID", type: "text", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true, secret: true },
      { key: "tenantId", label: "Tenant (organisation) ID", type: "text", required: true },
    ],
  },
  {
    key: "sage",
    label: "Sage Business Cloud",
    category: "Accounting",
    blurb:
      "Alternative to QuickBooks. Sync invoices and customers to Sage Business Cloud Accounting for teams standardized on Sage.",
    syncVerb: "Push invoices and customers",
    setupHint:
      "Register an app at the Sage developer portal, then paste its client id/secret and the business id to post to.",
    configFields: [
      { key: "clientId", label: "Client ID", type: "text", required: true },
      { key: "clientSecret", label: "Client secret", type: "password", required: true, secret: true },
      { key: "businessId", label: "Business ID", type: "text", required: true },
    ],
  },
  {
    key: "metrc",
    label: "Metrc",
    category: "Compliance",
    blurb:
      "State track-and-trace. Pull package and transfer state from Metrc so on-hand, tags, and manifests stay reconciled with the regulator.",
    syncVerb: "Pull packages and transfers",
    setupHint:
      "Metrc issues a vendor API key per integrator and a user API key per license holder. Pick your state and paste both.",
    configFields: [
      {
        key: "state",
        label: "State",
        type: "select",
        required: true,
        options: [
          { value: "ca", label: "California" },
          { value: "co", label: "Colorado" },
          { value: "mi", label: "Michigan" },
          { value: "mo", label: "Missouri" },
          { value: "or", label: "Oregon" },
        ],
      },
      { key: "vendorKey", label: "Vendor API key", type: "password", required: true, secret: true },
      { key: "userKey", label: "User API key", type: "password", required: true, secret: true },
    ],
  },
  {
    key: "leaflink",
    label: "LeafLink",
    category: "Marketplace",
    blurb:
      "Wholesale marketplace. Sync your catalog out to LeafLink and pull orders back in, so marketplace demand lands as real sales orders.",
    syncVerb: "Sync products and orders",
    setupHint:
      "Generate an API token from your LeafLink account settings (Developer / API section).",
    configFields: [
      { key: "apiToken", label: "API token", type: "password", required: true, secret: true },
      { key: "companyId", label: "Company ID", type: "text", required: false, help: "Optional - scopes the sync to one company." },
    ],
  },
  {
    key: "biotrack",
    label: "BioTrack",
    category: "Compliance",
    blurb:
      "Alternate state traceability system. Pull package inventory and lot state from BioTrack for states that run on it instead of Metrc.",
    syncVerb: "Pull packages and lots",
    setupHint:
      "Point at your state's BioTrack API endpoint and authenticate with your traceability username/password.",
    configFields: [
      { key: "apiUrl", label: "API endpoint", type: "url", required: true, placeholder: "https://…" },
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true, secret: true },
      { key: "locationId", label: "Location ID", type: "text", required: false },
    ],
  },
  {
    key: "onfleet",
    label: "Onfleet",
    category: "Logistics",
    blurb:
      "Last-mile delivery dispatch. Push orders that are ready to ship to Onfleet as delivery tasks and pull driver/route status back.",
    syncVerb: "Push deliveries, pull status",
    setupHint: "Copy an API key from your Onfleet dashboard under Settings, API & Webhooks.",
    configFields: [{ key: "apiKey", label: "API key", type: "password", required: true, secret: true }],
  },
  {
    key: "email",
    label: "Email (SMTP)",
    category: "Delivery",
    blurb:
      "Let automations email the reports and exports they produce - a scheduled low-stock report can land in an inbox every morning.",
    syncVerb: "Send a test message",
    setupHint: "Point at your transactional-email or SMTP provider (SendGrid, Postmark, Gmail SMTP, …).",
    configFields: [
      { key: "host", label: "SMTP host", type: "text", required: true, placeholder: "smtp.postmarkapp.com" },
      { key: "port", label: "Port", type: "text", required: true, placeholder: "587" },
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true, secret: true },
      { key: "fromAddress", label: "From address", type: "text", required: true, placeholder: "ops@yourbrand.com" },
    ],
  },
  {
    key: "google_drive",
    label: "Google Drive",
    category: "Delivery",
    blurb:
      "Upload the reports and exports your workflows produce straight to Drive, with a shareable link back to the file.",
    syncVerb: "Upload a test export",
    setupHint:
      "Create a Google Cloud service account with Drive access and paste its client email + private key.",
    configFields: [
      { key: "clientEmail", label: "Service account email", type: "text", required: true, placeholder: "svc@project.iam.gserviceaccount.com" },
      { key: "privateKey", label: "Private key", type: "password", required: true, secret: true },
      { key: "folderId", label: "Destination folder ID", type: "text", required: false },
    ],
  },
];

const PROVIDER_KEYS = new Set(PROVIDER_CATALOG.map((p) => p.key));

export function isProviderKey(x: string): x is ProviderKey {
  return PROVIDER_KEYS.has(x as ProviderKey);
}

export function providerMeta(key: ProviderKey): ProviderMeta {
  return PROVIDER_CATALOG.find((p) => p.key === key)!;
}

// ---------------- Configuration ----------------

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** True once every required credential/setting for a provider is present. */
export function isConfigured(key: ProviderKey, config: Record<string, unknown>): boolean {
  return providerMeta(key).configFields.every((f) => !f.required || !isBlank(config[f.key]));
}

/** Required config keys still missing (drives the "Setup required" affordance). */
export function missingConfig(key: ProviderKey, config: Record<string, unknown>): string[] {
  return providerMeta(key)
    .configFields.filter((f) => f.required && isBlank(config[f.key]))
    .map((f) => f.key);
}

/**
 * Config safe to hand the browser: non-secret values pass through; secret fields
 * are replaced by a boolean in `secretsSet` (so the form can show a "saved"
 * placeholder) and never leave the server in the clear.
 */
export function redactConfig(
  key: ProviderKey,
  config: Record<string, unknown>,
): { values: Record<string, string>; secretsSet: Record<string, boolean> } {
  const values: Record<string, string> = {};
  const secretsSet: Record<string, boolean> = {};
  for (const f of providerMeta(key).configFields) {
    if (f.secret) secretsSet[f.key] = !isBlank(config[f.key]);
    else values[f.key] = isBlank(config[f.key]) ? "" : String(config[f.key]);
  }
  return { values, secretsSet };
}

// ---------------- Connection state ----------------

export type Connection = ProviderMeta & {
  status: "connected" | "disconnected";
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  /** Whether every required credential is present (the setup gate). */
  configured: boolean;
  /** Non-secret config values, safe for the browser. */
  configValues: Record<string, string>;
  /** Per secret field: is a value saved? (never the value itself). */
  secretsSet: Record<string, boolean>;
  /** This provider connects via OAuth (needs an authorize redirect, not just creds). */
  oauth: boolean;
  /** OAuth provider that has completed the authorize step (has tokens). */
  authorized: boolean;
  /** Runs against the live vendor API (real creds, not the demo mock). */
  live: boolean;
};

/** All providers, each merged with its stored connection status (or defaults). */
export async function listConnections(ctx: ServiceCtx): Promise<Connection[]> {
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.organizationId, ctx.orgId));
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return PROVIDER_CATALOG.map((meta) => {
    const row = byProvider.get(meta.key);
    const config = row?.config ?? {};
    const { values, secretsSet } = redactConfig(meta.key, config);
    const oauth = isOAuthProvider(meta.key);
    // Demo connections (fake creds, mock sync) count as authorized so they read
    // "connected"; a real OAuth provider needs actual tokens.
    const authorized = oauth ? !!config.accessToken || !!config.refreshToken || config.__demo === true : true;
    return {
      ...meta,
      status: (row?.status as "connected" | "disconnected") ?? "disconnected",
      connectedAt: row?.connectedAt ?? null,
      lastSyncedAt: row?.lastSyncedAt ?? null,
      configured: isConfigured(meta.key, config),
      configValues: values,
      secretsSet,
      oauth,
      authorized,
      live: config.__demo !== true && isConfigured(meta.key, config) && hasLiveAdapter(meta.key),
    };
  });
}

export async function getConnection(
  ctx: ServiceCtx,
  provider: ProviderKey,
): Promise<ConnectionRow | null> {
  const [row] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, ctx.orgId),
        eq(integrationConnections.provider, provider),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Upsert the connection row for a provider (one per org+provider). */
async function upsertConnection(
  ctx: ServiceCtx,
  provider: ProviderKey,
  patch: Partial<
    Pick<ConnectionRow, "status" | "connectedAt" | "lastSyncedAt" | "config">
  >,
): Promise<ConnectionRow> {
  const existing = await getConnection(ctx, provider);
  if (existing) {
    const [row] = await db
      .update(integrationConnections)
      .set(patch)
      .where(eq(integrationConnections.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(integrationConnections)
    .values({
      organizationId: ctx.orgId,
      provider,
      status: patch.status ?? "disconnected",
      connectedAt: patch.connectedAt ?? null,
      lastSyncedAt: patch.lastSyncedAt ?? null,
      config: patch.config ?? {},
    })
    .returning();
  return row;
}

/**
 * Merge new credentials into a provider's stored config and, if every required
 * field is now present, mark it connected (ready to sync). Secret fields left
 * blank in the patch keep their saved value - so re-saving the form without
 * retyping a key doesn't wipe it. Non-secret fields take the patch value as-is
 * (so they can be cleared). Returns whether it ended up configured + what's
 * still missing, so the caller can surface an honest "setup required".
 */
export async function configureProvider(
  ctx: ServiceCtx,
  provider: ProviderKey,
  patch: Record<string, unknown>,
): Promise<{ row: ConnectionRow; configured: boolean; missing: string[] }> {
  const existing = (await getConnection(ctx, provider))?.config ?? {};
  const meta = providerMeta(provider);
  const merged: Record<string, unknown> = { ...existing };
  for (const f of meta.configFields) {
    const next = patch[f.key];
    if (f.secret) {
      if (!isBlank(next)) merged[f.key] = String(next).trim();
    } else if (f.key in patch) {
      merged[f.key] = isBlank(next) ? "" : String(next).trim();
    }
  }
  // Internal markers (e.g. `__demo`, OAuth tokens) pass through untouched.
  for (const k of Object.keys(patch)) if (k.startsWith("__") || k === "accessToken" || k === "refreshToken" || k === "tokenExpiresAt") merged[k] = patch[k];
  const configured = isConfigured(provider, merged);
  const row = await upsertConnection(ctx, provider, {
    config: merged,
    // Setting up complete credentials connects it; incomplete leaves it staged.
    status: configured ? "connected" : "disconnected",
    connectedAt: configured ? (await getConnection(ctx, provider))?.connectedAt ?? new Date() : null,
  });
  await recordAudit(ctx, {
    action: "integration.configure",
    entityType: "integration",
    entityId: row.id,
    after: { provider, configured },
  });
  return { row, configured, missing: missingConfig(provider, merged) };
}

/**
 * (Re)connect a provider that's already configured - e.g. after a disconnect.
 * Refuses if required credentials are missing, so "connected" always implies
 * "could actually reach the service".
 */
export async function connectProvider(
  ctx: ServiceCtx,
  provider: ProviderKey,
  config?: Record<string, unknown>,
): Promise<ConnectionRow> {
  const stored = (await getConnection(ctx, provider))?.config ?? {};
  const effective = config ? { ...stored, ...config } : stored;
  if (!isConfigured(provider, effective)) {
    throw new Error(
      `${providerMeta(provider).label} needs to be set up before it can connect - add its credentials first.`,
    );
  }
  const row = await upsertConnection(ctx, provider, {
    status: "connected",
    connectedAt: new Date(),
    ...(config ? { config: effective } : {}),
  });
  await recordAudit(ctx, {
    action: "integration.connect",
    entityType: "integration",
    entityId: row.id,
    after: { provider, status: "connected" },
  });
  return row;
}

export async function disconnectProvider(
  ctx: ServiceCtx,
  provider: ProviderKey,
): Promise<ConnectionRow> {
  const row = await upsertConnection(ctx, provider, {
    status: "disconnected",
    connectedAt: null,
  });
  await recordAudit(ctx, {
    action: "integration.disconnect",
    entityType: "integration",
    entityId: row.id,
    after: { provider, status: "disconnected" },
  });
  return row;
}

// ---------------- Sync events ----------------

export type RecordSyncEventInput = {
  provider: ProviderKey;
  direction: "push" | "pull";
  entityType: string;
  entityId?: string | null;
  summary: string;
  status?: "success" | "error";
};

export async function recordSyncEvent(
  ctx: ServiceCtx,
  input: RecordSyncEventInput,
): Promise<SyncEventRow> {
  const [row] = await db
    .insert(integrationSyncEvents)
    .values({
      organizationId: ctx.orgId,
      provider: input.provider,
      direction: input.direction,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      status: input.status ?? "success",
    })
    .returning();
  return row;
}

export async function listSyncEvents(
  ctx: ServiceCtx,
  opts: { provider?: ProviderKey; limit?: number } = {},
): Promise<SyncEventRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
  const where = opts.provider
    ? and(
        eq(integrationSyncEvents.organizationId, ctx.orgId),
        eq(integrationSyncEvents.provider, opts.provider),
      )
    : eq(integrationSyncEvents.organizationId, ctx.orgId);
  return db
    .select()
    .from(integrationSyncEvents)
    .where(where)
    .orderBy(desc(integrationSyncEvents.createdAt))
    .limit(limit);
}

// ---------------- Mock sync ----------------

type PlannedEvent = {
  direction: "push" | "pull";
  entityType: string;
  summary: string;
};

/**
 * Derive believable sync events for a provider from the org's REAL data, using
 * the existing mock provider seam where relevant. Deterministic given the data.
 */
async function planSync(
  ctx: ServiceCtx,
  provider: ProviderKey,
): Promise<PlannedEvent[]> {
  switch (provider) {
    case "quickbooks": {
      const [invoices, customers] = await Promise.all([
        listInvoices(ctx, { limit: 1 }),
        listCompanies(ctx, "CUSTOMER"),
      ]);
      return [
        {
          direction: "push",
          entityType: "invoice",
          summary: `Pushed ${invoices.total} invoice(s) to QuickBooks`,
        },
        {
          direction: "push",
          entityType: "customer",
          summary: `Matched ${customers.length} customer(s) in QuickBooks`,
        },
      ];
    }
    case "xero": {
      const [invoices, customers] = await Promise.all([
        listInvoices(ctx, { limit: 1 }),
        listCompanies(ctx, "CUSTOMER"),
      ]);
      return [
        { direction: "push", entityType: "invoice", summary: `Pushed ${invoices.total} invoice(s) to Xero` },
        { direction: "push", entityType: "contact", summary: `Matched ${customers.length} contact(s) in Xero` },
      ];
    }
    case "sage": {
      const [invoices, customers] = await Promise.all([
        listInvoices(ctx, { limit: 1 }),
        listCompanies(ctx, "CUSTOMER"),
      ]);
      return [
        { direction: "push", entityType: "invoice", summary: `Pushed ${invoices.total} invoice(s) to Sage` },
        { direction: "push", entityType: "customer", summary: `Synced ${customers.length} customer(s) to Sage` },
      ];
    }
    case "metrc": {
      const metrc = getMetrcProvider();
      const [pkgs, transfers] = await Promise.all([
        metrc.listPackages(ctx),
        metrc.listTransfers(ctx),
      ]);
      return [
        {
          direction: "pull",
          entityType: "package",
          summary: `Pulled ${pkgs.data.length} package(s) from Metrc`,
        },
        {
          direction: "pull",
          entityType: "transfer",
          summary: `Reconciled ${transfers.data.length} transfer manifest(s)`,
        },
      ];
    }
    case "leaflink": {
      const [products, orders] = await Promise.all([
        listProducts(ctx, { status: "ACTIVE", limit: 1 }),
        listOrders(ctx, { limit: 1 }),
      ]);
      return [
        {
          direction: "push",
          entityType: "product",
          summary: `Synced ${products.total} product listing(s) to LeafLink`,
        },
        {
          direction: "pull",
          entityType: "order",
          summary: `Pulled ${orders.total} marketplace order(s) from LeafLink`,
        },
      ];
    }
    case "biotrack": {
      const packages = await getMetrcProvider().listPackages(ctx);
      return [
        {
          direction: "pull",
          entityType: "package",
          summary: `Pulled ${packages.data.length} package(s) from BioTrack`,
        },
      ];
    }
    case "onfleet": {
      const [ready, delivering] = await Promise.all([
        listOrders(ctx, { status: "READY_TO_SHIP", limit: 1 }),
        listOrders(ctx, { status: "DELIVERING", limit: 1 }),
      ]);
      return [
        {
          direction: "push",
          entityType: "delivery",
          summary: `Dispatched ${ready.total} order(s) to Onfleet as delivery tasks`,
        },
        {
          direction: "pull",
          entityType: "delivery",
          summary: `Pulled status for ${delivering.total} in-transit delivery(ies)`,
        },
      ];
    }
    case "email": {
      return [
        {
          direction: "push",
          entityType: "message",
          summary: "Sent a test message through the connected email account",
        },
      ];
    }
    case "google_drive": {
      const pos = await listPurchaseOrders(ctx, { limit: 1 });
      return [
        {
          direction: "push",
          entityType: "file",
          summary: `Uploaded a test export to Drive (workspace has ${pos.total} PO(s))`,
        },
      ];
    }
  }
}

export type MockSyncResult = {
  provider: ProviderKey;
  events: SyncEventRow[];
  summary: string;
};

/**
 * Run a sync for a provider - LIVE against the vendor API when the connection
 * holds real credentials, otherwise the mocked-but-realistic path.
 *
 *  - Gate: must be configured (the "set it up first" check a live adapter makes).
 *  - A connection carrying real (non-`__demo`) credentials and backed by a live
 *    adapter (`lib/integrations/live`) makes ACTUAL API calls with those creds;
 *    a failure records an honest error event, never a faked success.
 *  - The seeded demo marks its configs `__demo` (fake creds), so it stays on the
 *    believable mock path - configuring a provider *for real* is what flips it
 *    live. Providers without a live adapter (Email/Drive) use the mock path.
 *
 * Either way: persist events, stamp lastSyncedAt, drop a notification.
 */
export async function runSync(ctx: ServiceCtx, provider: ProviderKey): Promise<MockSyncResult> {
  const meta = providerMeta(provider);
  const connection = await getConnection(ctx, provider);
  const config = connection?.config ?? {};
  if (!isConfigured(provider, config)) {
    throw new Error(`${meta.label} isn't set up yet. Add its credentials under Configure, then sync.`);
  }
  const now = new Date();
  const isDemo = config.__demo === true;
  const live = !isDemo && hasLiveAdapter(provider);

  let planned: PlannedEvent[];
  let ok = true;
  if (live) {
    try {
      // Persist refreshed OAuth tokens (or any config the adapter updates).
      const persist = async (patch: Record<string, unknown>) => {
        Object.assign(config, patch);
        await upsertConnection(ctx, provider, { config: { ...config } });
      };
      planned = await runLiveSync(provider, config, persist);
    } catch (err) {
      ok = false;
      planned = [{ direction: "pull", entityType: "error", summary: `Live ${meta.label} sync failed - ${err instanceof Error ? err.message : "error"}` }];
    }
  } else {
    planned = await planSync(ctx, provider);
  }

  const events: SyncEventRow[] = [];
  for (const p of planned) {
    events.push(await recordSyncEvent(ctx, { provider, direction: p.direction, entityType: p.entityType, summary: p.summary, status: ok ? "success" : "error" }));
  }

  await upsertConnection(ctx, provider, {
    status: "connected",
    connectedAt: connection?.connectedAt ?? now,
    lastSyncedAt: now,
  });

  const summary = planned.map((p) => p.summary).join("; ") || "Nothing to sync";
  await createNotification(ctx, {
    userId: null,
    kind: "integration.sync",
    title: `${meta.label} sync ${ok ? "complete" : "failed"}`,
    body: summary,
    href: "/settings/integrations",
  });

  return { provider, events, summary };
}

/** Back-compat alias (the sync is now live-or-mock, not always mocked). */
export const runMockSync = runSync;
