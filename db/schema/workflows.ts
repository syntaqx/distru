import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { pk, timestamps } from "./_shared";

/**
 * Automated workflows: a saved instruction the agent runs on a trigger. The same
 * harness that powers the chat Copilot executes these headlessly (auto-approving
 * its actions, since no human is present) - the trigger-agnostic design realized.
 */
export const workflows = pgTable(
  "workflows",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    instruction: text().notNull(),
    trigger: text().notNull().default("manual"), // manual | schedule
    schedule: text(), // human cron-ish description when trigger = schedule
    status: text().notNull().default("active"),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    lastRunAt: timestamp({ withTimezone: true }),
    lastRunStatus: text(),
    ...timestamps(),
  },
  (t) => [index("workflows_org_idx").on(t.organizationId)],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    workflowId: uuid()
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    status: text().notNull().default("running"), // running | success | error
    summary: text(),
    conversationId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("workflow_runs_wf_idx").on(t.workflowId)],
);
