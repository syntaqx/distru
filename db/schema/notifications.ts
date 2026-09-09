import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization } from "./auth";
import { pk } from "./_shared";

/**
 * In-app notifications - what makes "a workflow finished" reach a human. A
 * completed run drops one here with a deep link to its results; the topbar bell
 * surfaces the unread ones. `userId` null = org-wide (everyone sees it).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid(), // null => visible to the whole org
    kind: text().notNull(), // workflow.success | workflow.error | report.ready | delivery.sent
    title: text().notNull(),
    body: text(),
    href: text(), // deep link to the results
    read: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_org_idx").on(t.organizationId)],
);
