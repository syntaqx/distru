import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { pk, timestamps } from "./_shared";
import type { HarnessToolPreview } from "../../lib/harness/types";

export const conversations = pgTable(
  "conversations",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid().references(() => user.id, { onDelete: "set null" }),
    title: text().notNull().default("New conversation"),
    ...timestamps(),
  },
  (t) => [index("conversations_org_idx").on(t.organizationId)],
);

/**
 * Messages store the raw Anthropic content-block array (text / thinking /
 * tool_use / tool_result), so a conversation can be replayed to the model
 * verbatim - critical for the resumable human-in-the-loop flow.
 */
export const messages = pgTable(
  "messages",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text().notNull(), // user | assistant
    content: jsonb().$type<unknown[]>().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.id)],
);

/**
 * Tool calls are persisted separately for the audit trail and to drive the
 * human-in-the-loop gate: mutating/ask tools are recorded `pending` and only
 * executed after a decision arrives via the resume endpoint.
 */
export const toolCalls = pgTable(
  "tool_calls",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    toolUseId: text().notNull(), // Anthropic tool_use block id
    name: text().notNull(),
    input: jsonb().$type<Record<string, unknown>>().notNull(),
    output: jsonb().$type<unknown>(),
    // pending | executed | rejected | error | auto
    status: text().notNull().default("pending"),
    requiresConfirmation: text().notNull().default("false"),
    preview: jsonb().$type<HarnessToolPreview | null>(),
    decision: text(), // approve | reject | answer
    decidedBy: uuid().references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tool_calls_conversation_idx").on(t.conversationId),
    index("tool_calls_tooluse_idx").on(t.toolUseId),
  ],
);
