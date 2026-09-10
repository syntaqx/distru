import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { pk, timestamps } from "./_shared";

/**
 * Third-party integration connections - the operator-visible "is this system
 * wired up?" state for each external service Distru talks to (QuickBooks, Metrc,
 * LeafLink, BioTrack, Onfleet, Email, Google Drive). The actual data seam lives
 * in `lib/integrations` (env-selected mock/real adapters); this table only tracks
 * whether the org has *connected* a provider and when it last synced, so the
 * Integrations screen can show real status and a "Sync now" affordance. One row
 * per (org, provider); `config` holds provider-specific settings (a license
 * number, a realm id, an API key handle) the mock doesn't need but a real
 * adapter would.
 */
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text().notNull(), // quickbooks | metrc | leaflink | biotrack | onfleet | email | google_drive
    status: text().notNull().default("disconnected"), // connected | disconnected
    connectedAt: timestamp({ withTimezone: true }),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    lastSyncedAt: timestamp({ withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("integration_connections_org_provider_idx").on(
      t.organizationId,
      t.provider,
    ),
  ],
);

/**
 * An audit of what a (mock or real) integration actually *did*: each push/pull
 * of records to/from an external system. This is what makes the mocked
 * integrations visibly do work - "Pushed 12 invoices to QuickBooks", "Pulled 30
 * packages from Metrc" - surfaced as a live feed on the Integrations screen.
 */
export const integrationSyncEvents = pgTable(
  "integration_sync_events",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    direction: text().notNull(), // push | pull
    entityType: text("entity_type").notNull(), // invoice | package | order | product | ...
    entityId: text("entity_id"),
    summary: text().notNull(),
    status: text().notNull().default("success"), // success | error
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("integration_sync_events_org_idx").on(t.organizationId, t.createdAt),
    index("integration_sync_events_provider_idx").on(
      t.organizationId,
      t.provider,
      t.createdAt,
    ),
  ],
);
