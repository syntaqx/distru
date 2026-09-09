/**
 * Deterministic pseudo-random helpers so mock integrations produce STABLE,
 * API-accurate ids/values for a given entity — the same product always maps to
 * the same Metrc label, the same company to the same QuickBooks id, etc. No
 * randomness, so responses are reproducible across requests and restarts.
 */

/** FNV-1a 32-bit hash of a string → unsigned int. */
export function hashInt(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A hex token of `len` chars, deterministic in `seed`. */
export function hashHex(seed: string, len = 8): string {
  let out = "";
  let i = 0;
  while (out.length < len) out += hashInt(`${seed}:${i++}`).toString(16).padStart(8, "0");
  return out.slice(0, len);
}

/** A stable integer id in [1, 10^digits) for a seed — how Metrc/LeafLink number rows. */
export function hashNumericId(seed: string, digits = 8): number {
  const mod = 10 ** digits;
  return (hashInt(seed) % (mod - 1)) + 1;
}

/** Pick a deterministic element of `arr` for `seed`. */
export function pick<T>(arr: readonly T[], seed: string): T {
  return arr[hashInt(seed) % arr.length];
}

/** Microsecond ISO-8601 Z, matching Distru's datetime format, offset from a base. */
export function isoMicro(base: Date, offsetSeconds = 0): string {
  const d = new Date(base.getTime() + offsetSeconds * 1000);
  return d.toISOString().replace("Z", "000Z");
}

/**
 * A Metrc RFID tag (24 chars) for an entity: a realistic California-style tag
 * `1A4FF01...` deterministic in the seed. Metrc tags are 24 uppercase alphanum.
 */
export function metrcTag(seed: string): string {
  const body = hashHex(seed, 20).toUpperCase();
  return `1A4FF${body.slice(0, 19)}`.slice(0, 24).padEnd(24, "0");
}
