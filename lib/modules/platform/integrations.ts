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

export type ConnectionRow = typeof integrationConnections.$inferSelect;
export type SyncEventRow = typeof integrationSyncEvents.$inferSelect;

export type ProviderKey =
  | "quickbooks"
  | "metrc"
  | "leaflink"
  | "biotrack"
  | "onfleet"
  | "email"
  | "google_drive";

export type ProviderMeta = {
  key: ProviderKey;
  label: string;
  category: string;
  blurb: string;
  /** What "Sync now" does, in plain language (shown as the button hint). */
  syncVerb: string;
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
  },
  {
    key: "metrc",
    label: "Metrc",
    category: "Compliance",
    blurb:
      "State track-and-trace. Pull package and transfer state from Metrc so on-hand, tags, and manifests stay reconciled with the regulator.",
    syncVerb: "Pull packages and transfers",
  },
  {
    key: "leaflink",
    label: "LeafLink",
    category: "Marketplace",
    blurb:
      "Wholesale marketplace. Sync your catalog out to LeafLink and pull orders back in, so marketplace demand lands as real sales orders.",
    syncVerb: "Sync products and orders",
  },
  {
    key: "biotrack",
    label: "BioTrack",
    category: "Compliance",
    blurb:
      "Alternate state traceability system. Pull package inventory and lot state from BioTrack for states that run on it instead of Metrc.",
    syncVerb: "Pull packages and lots",
  },
  {
    key: "onfleet",
    label: "Onfleet",
    category: "Logistics",
    blurb:
      "Last-mile delivery dispatch. Push orders that are ready to ship to Onfleet as delivery tasks and pull driver/route status back.",
    syncVerb: "Push deliveries, pull status",
  },
  {
    key: "email",
    label: "Email",
    category: "Delivery",
    blurb:
      "Let automations email the reports and exports they produce - a scheduled low-stock report can land in an inbox every morning.",
    syncVerb: "Send a test message",
  },
  {
    key: "google_drive",
    label: "Google Drive",
    category: "Delivery",
    blurb:
      "Upload the reports and exports your workflows produce straight to Drive, with a shareable link back to the file.",
    syncVerb: "Upload a test export",
  },
];

const PROVIDER_KEYS = new Set(PROVIDER_CATALOG.map((p) => p.key));

export function isProviderKey(x: string): x is ProviderKey {
  return PROVIDER_KEYS.has(x as ProviderKey);
}

export function providerMeta(key: ProviderKey): ProviderMeta {
  return PROVIDER_CATALOG.find((p) => p.key === key)!;
}

// ---------------- Connection state ----------------

export type Connection = ProviderMeta & {
  status: "connected" | "disconnected";
  connectedAt: Date | null;
  lastSyncedAt: Date | null;
  config: Record<string, unknown>;
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
    return {
      ...meta,
      status: (row?.status as "connected" | "disconnected") ?? "disconnected",
      connectedAt: row?.connectedAt ?? null,
      lastSyncedAt: row?.lastSyncedAt ?? null,
      config: row?.config ?? {},
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

export async function connectProvider(
  ctx: ServiceCtx,
  provider: ProviderKey,
  config?: Record<string, unknown>,
): Promise<ConnectionRow> {
  const row = await upsertConnection(ctx, provider, {
    status: "connected",
    connectedAt: new Date(),
    ...(config ? { config } : {}),
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
 * Run a mocked-but-realistic sync for a provider: generate sync events from real
 * org data, persist them, stamp lastSyncedAt, and drop a notification. Connecting
 * the provider first is not required (the demo just works), but a successful sync
 * marks it connected so status and last-synced stay coherent.
 */
export async function runMockSync(
  ctx: ServiceCtx,
  provider: ProviderKey,
): Promise<MockSyncResult> {
  const meta = providerMeta(provider);
  const planned = await planSync(ctx, provider);
  const now = new Date();

  const events: SyncEventRow[] = [];
  for (const p of planned) {
    events.push(
      await recordSyncEvent(ctx, {
        provider,
        direction: p.direction,
        entityType: p.entityType,
        summary: p.summary,
      }),
    );
  }

  await upsertConnection(ctx, provider, {
    status: "connected",
    connectedAt: (await getConnection(ctx, provider))?.connectedAt ?? now,
    lastSyncedAt: now,
  });

  const summary = planned.map((p) => p.summary).join("; ") || "Nothing to sync";
  await createNotification(ctx, {
    userId: null,
    kind: "integration.sync",
    title: `${meta.label} sync complete`,
    body: summary,
    href: "/settings/integrations",
  });

  return { provider, events, summary };
}
