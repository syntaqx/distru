import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pk } from "./_shared";

/**
 * better-auth core + organization plugin tables.
 *
 * Column JS keys match better-auth's model field names exactly (the Drizzle
 * adapter maps by key); DB column names are snake_cased by the `casing` option.
 * IDs are UUIDs - better-auth is configured with `generateId: () => uuidv7()`,
 * so every row (auth + domain) shares one UUIDv7 keyspace.
 */

export const user = pgTable("user", {
  id: pk(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
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
});

export const account = pgTable("account", {
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
});

export const verification = pgTable("verification", {
  id: pk(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  id: pk(),
  name: text().notNull(),
  slug: text().unique(),
  logo: text(),
  metadata: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const member = pgTable("member", {
  id: pk(),
  organizationId: uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text().notNull().default("member"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const invitation = pgTable("invitation", {
  id: pk(),
  organizationId: uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text().notNull(),
  role: text(),
  status: text().notNull().default("pending"),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  inviterId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
