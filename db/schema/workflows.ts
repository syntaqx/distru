import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { pk, timestamps } from "./_shared";
import type { NodeRun, WorkflowGraph } from "@/lib/harness/graph/types";

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
    /**
     * The n8n-shaped node graph. When present, the graph executor runs it; when
     * null, `instruction` is run as an implicit single-agent graph (legacy rows).
     */
    graph: jsonb().$type<WorkflowGraph | null>(),
    /** When this schedule is next due to fire (set for trigger = schedule). */
    nextRunAt: timestamp({ withTimezone: true }),
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
    /** Per-node execution record for graph runs (null for legacy single-agent runs). */
    nodeRuns: jsonb().$type<NodeRun[] | null>(),
    /** What kicked off the run: manual | schedule | webhook | event. */
    trigger: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("workflow_runs_wf_idx").on(t.workflowId)],
);
