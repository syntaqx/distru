import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { products } from "./catalog";
import { importRowStatus, importStatus, pk, timestamps } from "./_shared";
import type { ColumnMapping, RowError } from "../../lib/imports/types";

/** The uploaded file: original bytes (base64) plus parsed headers and a sample. */
export const importFiles = pgTable("import_files", {
  id: pk(),
  organizationId: uuid()
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  filename: text().notNull(),
  contentType: text().notNull(),
  sizeBytes: integer().notNull().default(0),
  contentBase64: text().notNull(),
  headers: text().array().notNull().default([]),
  sampleRows: jsonb().$type<Record<string, unknown>[]>().notNull().default([]),
  rowCount: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** One import run. The agent orchestrates this; heavy lifting is deterministic. */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: pk(),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: uuid().references(() => user.id, { onDelete: "set null" }),
    conversationId: uuid(),
    targetKey: text().notNull().default("products"),
    status: importStatus().notNull().default("UPLOADED"),
    fileId: uuid()
      .notNull()
      .references(() => importFiles.id, { onDelete: "cascade" }),
    mapping: jsonb().$type<ColumnMapping | null>(),
    totalRows: integer().notNull().default(0),
    validRows: integer().notNull().default(0),
    warningRows: integer().notNull().default(0),
    errorRows: integer().notNull().default(0),
    committedRows: integer().notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("import_jobs_org_idx").on(t.organizationId)],
);

/** Every source row lives here - never in the LLM context. */
export const importRows = pgTable(
  "import_rows",
  {
    id: pk(),
    jobId: uuid()
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    organizationId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    rowIndex: integer().notNull(),
    raw: jsonb().$type<Record<string, unknown>>().notNull(),
    mapped: jsonb().$type<Record<string, unknown> | null>(),
    status: importRowStatus().notNull().default("PENDING"),
    errors: jsonb().$type<RowError[]>().notNull().default([]),
    productId: uuid().references(() => products.id, { onDelete: "set null" }),
  },
  (t) => [index("import_rows_job_idx").on(t.jobId, t.rowIndex)],
);
