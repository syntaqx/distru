import type { ServiceCtx } from "@/lib/modules/shared";
import { createLocation, listLocations } from "@/lib/modules/catalog";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

/**
 * A physical-locations import (warehouses, rooms, sites). Added as a single file
 * to show the framework really does scale to an unrelated CSV type: registering
 * this made location import work end to end (detect, map, validate, partial
 * commit, error CSV) with zero pipeline changes.
 */
type Prep = { existing: Set<string> };
type LocationValue = { name: string };

const FIELDS: CanonicalField[] = [
  {
    key: "name",
    label: "Location Name",
    type: "string",
    required: true,
    aliases: ["location", "name", "warehouse", "room", "site", "facility", "address"],
  },
];

export const locationsTarget: ImportTarget<Prep, LocationValue> = {
  key: "locations",
  label: "Locations",
  description: "Import a list of physical locations (warehouses, rooms, sites).",
  fields: FIELDS,
  async prepare(ctx: ServiceCtx) {
    const locations = await listLocations(ctx);
    return { existing: new Set(locations.map((l) => l.name.toLowerCase())) };
  },
  validateRow(mapped) {
    const name = mapped.name ? String(mapped.name).trim() : "";
    if (!name) {
      const errors: RowError[] = [
        { field: "name", code: "required", message: "Location Name is required" },
      ];
      return { ok: false, errors };
    }
    return { ok: true, value: { name } };
  },
  async commitRows(rows, ctx, prep) {
    const out: { productId?: string | null }[] = [];
    for (const { value } of rows) {
      if (!prep.existing.has(value.name.toLowerCase())) {
        await createLocation(ctx, { name: value.name });
        prep.existing.add(value.name.toLowerCase());
      }
      out.push({ productId: null });
    }
    return out;
  },
};
