import { datetime } from "@/lib/modules/shared";

/**
 * Distru report envelope. Every `/reports/*` endpoint returns the same shape:
 * a `data` array of flat row objects whose keys line up with `meta.columns`,
 * plus a `meta` block describing the columns and when the report was run.
 * Numbers and money are emitted as strings (see `@/lib/modules/shared` `num`).
 */

export type ReportColumn = { key: string; label: string };
export type ReportRow = Record<string, unknown>;

export function reportEnvelope(columns: ReportColumn[], rows: ReportRow[]) {
  return {
    data: rows,
    meta: {
      columns,
      date_range: null,
      generated_datetime: datetime(new Date()),
    },
  };
}

/** An empty report envelope for subject areas this clone has no data for. */
export function emptyReport() {
  return reportEnvelope([], []);
}
