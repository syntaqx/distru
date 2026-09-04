import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { pk, timestamps } from "./_shared";

/**
 * API tokens for the Distru-faithful public API + MCP server. Only a SHA-256
 * hash is stored; the plaintext (dk_live_...) is shown once at creation.
 */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    tokenHash: text().notNull().unique(),
    tokenPrefix: text().notNull(),
    scopes: text().array().notNull().default(["products:read", "products:write"]),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    lastUsedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_tokens_org_idx").on(t.organizationId)],
);

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    url: text().notNull(),
    secret: text().notNull(),
    events: text().array().notNull().default(["product.created", "product.updated"]),
    active: boolean().notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("webhook_endpoints_org_idx").on(t.organizationId)],
);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: pk(),
  organizationId: uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  endpointId: uuid()
    .notNull()
    .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  eventType: text().notNull(),
  payload: jsonb().$type<Record<string, unknown>>().notNull(),
  status: text().notNull().default("pending"),
  responseStatus: integer(),
  attempts: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Cross-face audit trail: every mutation from chat, API, MCP, or import. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorType: text().notNull(), // user | agent | api | system | import
    actorId: text(),
    action: text().notNull(), // e.g. product.create
    entityType: text().notNull(),
    entityId: uuid(),
    before: jsonb().$type<Record<string, unknown> | null>(),
    after: jsonb().$type<Record<string, unknown> | null>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_org_idx").on(t.organizationId, t.createdAt)],
);
