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

// ---------------- Platform: cross-cutting resources ----------------

/**
 * A custom-field DEFINITION: the schema for the ad-hoc fields that appear as
 * `custom_data` on products, companies, orders, etc. Distru lets operators define
 * these per entity type.
 */
export const customFields = pgTable(
  "custom_fields",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // product | company | order | invoice | ...
    name: text().notNull(),
    fieldType: text("field_type").notNull().default("TEXT"), // TEXT | NUMBER | DATE | BOOLEAN | SELECT
    ...timestamps(),
  },
  (t) => [index("custom_fields_org_entity_idx").on(t.organizationId, t.entityType)],
);

/** A file attached to any entity (COA PDF, contract, label, ...). */
export const fileAttachments = pgTable(
  "file_attachments",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    filename: text().notNull(),
    url: text(),
    contentType: text("content_type"),
    ...timestamps(),
  },
  (t) => [index("file_attachments_org_entity_idx").on(t.organizationId, t.entityType, t.entityId)],
);

/** A task/to-do, optionally assigned to a user and linked to an entity. */
export const tasks = pgTable(
  "tasks",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text().notNull(),
    status: text().notNull().default("OPEN"), // OPEN | IN_PROGRESS | DONE
    assigneeId: uuid("assignee_id").references(() => user.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    ...timestamps(),
  },
  (t) => [index("tasks_org_status_idx").on(t.organizationId, t.status)],
);
