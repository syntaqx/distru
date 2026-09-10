import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { pk } from "./_shared";

/**
 * better-auth core + organization plugin tables.
 *
 * Table names are PLURAL (`users`, `sessions`, …) to match the rest of the
 * schema's convention. Column JS keys match better-auth's model field names
 * exactly (the Drizzle adapter maps by key); DB column names are snake_cased by
 * the `casing` option. IDs are UUIDs - better-auth is configured with
 * `generateId: () => uuidv7()`, so every row (auth + domain) shares one UUIDv7
 * keyspace. `relations` are declared below because better-auth 1.7+'s Drizzle
 * adapter reads sessions/members through Drizzle's relational query API.
 */

export const user = pgTable("users", {
  id: pk(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "sessions",
  {
    id: pk(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ipAddress: text(),
    userAgent: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // organization plugin: the workspace the user is currently acting in.
    activeOrganizationId: uuid(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const account = pgTable(
  "accounts",
  {
    id: pk(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    // better-auth 1.7: account identity is scoped by issuer.
    issuer: text(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const verification = pgTable("verifications", {
  id: pk(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const organization = pgTable("organizations", {
  id: pk(),
  name: text().notNull(),
  slug: text().unique(),
  logo: text(),
  metadata: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const member = pgTable(
  "members",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull().default("member"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("members_org_idx").on(t.organizationId),
    index("members_user_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitations",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: text(),
    status: text().notNull().default("pending"),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    // Required by better-auth 1.7.4's organization plugin.
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    inviterId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("invitations_org_idx").on(t.organizationId)],
);

// ---- Relations (for better-auth 1.7+'s relational reads) ---------------------

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [member.userId], references: [user.id] }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, { fields: [invitation.inviterId], references: [user.id] }),
}));
