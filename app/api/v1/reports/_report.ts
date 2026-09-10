/**
 * The Distru report envelope + column types now live in the reports module (the
 * single source of truth). Re-exported here so existing importers keep working.
 */
export {
  reportEnvelope,
  emptyReport,
  type ReportColumn,
  type ReportRow,
} from "@/lib/modules/reports";
