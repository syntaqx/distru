import { formatDistanceToNowStrict } from "date-fns";

/**
 * Relative time ("5 minutes ago", "3 days ago", "2 months ago"), the one place
 * the app formats it. Backed by date-fns so ranges up to years and the edge
 * cases are handled correctly rather than hand-rolled per component. Accepts a
 * Date, ISO string, or epoch ms; returns "" for null/invalid input.
 */
export function timeAgo(value: Date | string | number | null | undefined): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNowStrict(d, { addSuffix: true });
}
