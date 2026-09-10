import { describe, expect, it } from "vitest";
// Deep-import the leaf module on purpose: the public barrel (@/lib/modules/shared)
// re-exports audit.ts, which imports @/db and instantiates a Postgres client at
// load. These are pure, DB-free unit tests, so we import the serializer directly.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { customData, datetime, fromCustomData, num, ref } from "@/lib/modules/shared/serialize";

describe("num", () => {
  it("formats numbers and numeric strings to 6-decimal fixed strings", () => {
    expect(num(25)).toBe("25.000000");
    expect(num("25")).toBe("25.000000");
    expect(num(0)).toBe("0.000000");
    expect(num("-4.5")).toBe("-4.500000");
  });

  it("rounds to 6 decimals", () => {
    expect(num(1.23456789)).toBe("1.234568");
  });

  it("returns null for null, undefined, and empty string", () => {
    expect(num(null)).toBeNull();
    expect(num(undefined)).toBeNull();
    expect(num("")).toBeNull();
  });

  it("passes non-finite / unparseable values through as their original string", () => {
    expect(num("abc")).toBe("abc");
    expect(num(Infinity)).toBe("Infinity");
  });
});

describe("datetime", () => {
  it("returns UTC ISO-8601 padded to microsecond precision", () => {
    expect(datetime(new Date("2024-03-04T05:06:07.123Z"))).toBe("2024-03-04T05:06:07.123000Z");
  });

  it("accepts ISO strings", () => {
    expect(datetime("2024-01-01T00:00:00.000Z")).toBe("2024-01-01T00:00:00.000000Z");
  });

  it("returns null for null/undefined/empty", () => {
    expect(datetime(null)).toBeNull();
    expect(datetime(undefined)).toBeNull();
    expect(datetime("")).toBeNull();
  });
});

describe("customData", () => {
  it("serializes a key->value map into Distru's {id,name,value} array", () => {
    expect(customData({ strain: "OG", thc: 22, tested: true })).toEqual([
      { id: "strain", name: "strain", value: "OG" },
      { id: "thc", name: "thc", value: 22 },
      { id: "tested", name: "tested", value: true },
    ]);
  });

  it("returns an empty array for null/undefined", () => {
    expect(customData(null)).toEqual([]);
    expect(customData(undefined)).toEqual([]);
  });
});

describe("fromCustomData", () => {
  it("parses the array form using id then name as the key", () => {
    expect(fromCustomData([{ id: "strain", value: "OG" }, { name: "thc", value: 22 }])).toEqual({
      strain: "OG",
      thc: 22,
    });
  });

  it("skips array entries with neither id nor name and non-objects", () => {
    expect(fromCustomData([{ value: "x" }, null, "nope", { id: "k", value: 1 }])).toEqual({ k: 1 });
  });

  it("passes a plain object through unchanged", () => {
    expect(fromCustomData({ a: 1, b: "two" })).toEqual({ a: 1, b: "two" });
  });

  it("returns undefined for null/undefined input", () => {
    expect(fromCustomData(null)).toBeUndefined();
    expect(fromCustomData(undefined)).toBeUndefined();
  });
});

describe("ref", () => {
  it("projects an entity down to {id,name}, dropping extra fields", () => {
    expect(ref({ id: "1", name: "Acme", extra: "ignored" } as { id: string; name: string })).toEqual({
      id: "1",
      name: "Acme",
    });
  });

  it("returns null for null/undefined", () => {
    expect(ref(null)).toBeNull();
    expect(ref(undefined)).toBeNull();
  });
});
