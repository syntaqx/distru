/**
 * Distru-faithful serialization helpers for the public API face.
 *
 * Mirrors the conventions documented at apidocs.distru.dev:
 *  - numbers are returned as strings to preserve precision ("25.000000")
 *  - datetimes are UTC ISO-8601 with microsecond precision
 *  - optional fields are always present (null, never omitted)
 *  - enums are uppercase strings
 */

/**
 * Render a numeric/decimal value as a fixed 6-decimal string (Distru's decimal
 * convention, e.g. "25.000000"), or null. DB decimal columns already arrive at
 * this precision; this also normalizes JS-computed values (totals, balances) so
 * every numeric field on a payload is formatted consistently.
 */
export function num(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(6) : String(value);
}

/** UTC ISO-8601 with microsecond precision, matching Distru's datetimes. */
export function datetime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  // toISOString gives millisecond precision; pad to microseconds.
  return d.toISOString().replace("Z", "000Z");
}

/**
 * Serialize a stored custom-fields object to Distru's `custom_data` shape: an
 * array of { id, name, value }. We store custom fields as a key->value map, so
 * the field key doubles as its id and name.
 */
export function customData(
  fields: Record<string, string | number | boolean | null> | null | undefined,
): { id: string; name: string; value: string | number | boolean | null }[] {
  return Object.entries(fields ?? {}).map(([key, value]) => ({ id: key, name: key, value }));
}

/**
 * Parse an inbound `custom_data` payload back to the stored key->value map.
 * Accepts either Distru's array form ([{ id|name, value }]) or a plain object.
 */
export function fromCustomData(
  input: unknown,
): Record<string, string | number | boolean | null> | undefined {
  if (input == null) return undefined;
  if (Array.isArray(input)) {
    const out: Record<string, string | number | boolean | null> = {};
    for (const entry of input) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as { id?: string; name?: string; value?: unknown };
      const key = e.id ?? e.name;
      if (!key) continue;
      out[key] = e.value as string | number | boolean | null;
    }
    return out;
  }
  if (typeof input === "object") return input as Record<string, string | number | boolean | null>;
  return undefined;
}

/** Minimal nested reference object, e.g. { id, name } or null. */
export function ref(
  entity: { id: string; name: string } | null | undefined,
): { id: string; name: string } | null {
  if (!entity) return null;
  return { id: entity.id, name: entity.name };
}
