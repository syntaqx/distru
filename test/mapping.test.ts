import { describe, expect, it } from "vitest";
import { deterministicMapping } from "@/lib/imports/mapping";
import type { ImportTarget } from "@/lib/imports/target";
import type { CanonicalField } from "@/lib/imports/types";

function makeTarget(fields: CanonicalField[]): ImportTarget {
  return {
    key: "test",
    label: "Test",
    description: "test target",
    fields,
    prepare: async () => ({}),
    validateRow: () => ({ ok: true, value: {} }),
    commitRows: async () => [],
  };
}

const target = makeTarget([
  { key: "name", label: "Name", type: "string", required: true },
  { key: "sku", label: "SKU", type: "string", required: false, aliases: ["code"] },
  { key: "price", label: "Price", type: "number", required: false },
]);

describe("deterministicMapping", () => {
  it("matches exact header/label/alias with high confidence", () => {
    const { entries } = deterministicMapping(["Name", "code"], target);
    const name = entries.find((e) => e.targetField === "name")!;
    const sku = entries.find((e) => e.targetField === "sku")!;
    expect(name).toMatchObject({ sourceColumn: "Name", confidence: 0.95 });
    // "code" is an alias of sku, so it maps there at high confidence.
    expect(sku).toMatchObject({ sourceColumn: "code", confidence: 0.95 });
  });

  it("uses lower confidence for substring (fuzzy) header matches", () => {
    const { entries } = deterministicMapping(["Product Name"], target);
    const name = entries.find((e) => e.targetField === "name")!;
    expect(name).toMatchObject({ sourceColumn: "Product Name", confidence: 0.7 });
  });

  it("leaves unmatched fields unmapped and lists leftover columns as unmapped", () => {
    const result = deterministicMapping(["Name", "Notes"], target);
    const price = result.entries.find((e) => e.targetField === "price")!;
    expect(price).toEqual({ targetField: "price", sourceColumn: null, confidence: 0 });
    expect(result.unmapped).toEqual(["Notes"]);
  });

  it("never assigns one source column to two target fields", () => {
    // Two fields both plausibly matching "title"; only one wins the column.
    const t = makeTarget([
      { key: "name", label: "Name", type: "string", required: true, aliases: ["title"] },
      { key: "label", label: "Label", type: "string", required: false, aliases: ["title"] },
    ]);
    const { entries } = deterministicMapping(["title"], t);
    const used = entries.filter((e) => e.sourceColumn === "title");
    expect(used).toHaveLength(1);
  });

  it("returns one entry per canonical field regardless of matches", () => {
    const { entries } = deterministicMapping([], target);
    expect(entries.map((e) => e.targetField)).toEqual(["name", "sku", "price"]);
    expect(entries.every((e) => e.sourceColumn === null && e.confidence === 0)).toBe(true);
  });
});
