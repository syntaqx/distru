/**
 * Distru-faithful serialization helpers for the public API face.
 *
 * Mirrors the conventions documented at apidocs.distru.dev:
 *  - numbers are returned as strings to preserve precision ("25.000000")
 *  - datetimes are UTC ISO-8601 with microsecond precision
 *  - optional fields are always present (null, never omitted)
 *  - enums are uppercase strings
 */

/** Render a numeric/decimal value as a precision-preserving string, or null. */
export function num(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

/** UTC ISO-8601 with microsecond precision, matching Distru's datetimes. */
export function datetime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  // toISOString gives millisecond precision; pad to microseconds.
  return d.toISOString().replace("Z", "000Z");
}

/** Minimal nested reference object, e.g. { id, name } or null. */
export function ref(
  entity: { id: string; name: string } | null | undefined,
): { id: string; name: string } | null {
  if (!entity) return null;
  return { id: entity.id, name: entity.name };
}
