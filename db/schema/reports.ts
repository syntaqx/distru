import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { pk } from "./_shared";

/**
 * Artifacts - durable outputs a workflow (or the Copilot) produces: a report, an
 * export. This is what turns "the agent ran and said some text" into a real
 * deliverable that lives in a Reports section and can be emailed or uploaded to
 * Drive. Linked back to the run/conversation that made it for provenance.
 */
export const artifacts = pgTable(
  "artifacts",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text().notNull(),
    kind: text().notNull().default("report"), // report | export
    format: text().notNull().default("markdown"), // markdown | csv | json | text
    content: text().notNull(),
    // Provenance: which run/conversation/actor produced this.
    workflowId: uuid(),
    workflowRunId: uuid(),
    conversationId: uuid(),
    createdBy: text(),
    /** Where this artifact has been delivered (email/drive), append-only. */
    deliveries: jsonb()
      .$type<{ destination: string; target: string; externalId: string | null; at: string }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("artifacts_org_idx").on(t.organizationId),
    index("artifacts_run_idx").on(t.workflowRunId),
  ],
);
