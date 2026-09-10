---
title: "The import pipeline"
section: "Copilot & take-home"
summary: "How any CSV becomes catalog: the generic framework, detection, and stages."
keywords: ["import pipeline","csv","framework","importtarget","detection","mapping","validate","commit","error csv","scale","chunk","engineering"]
order: 114
---
# The import pipeline

Built as a generic framework, not a product-only script, so it scales to other file types. The agent orchestrates and never sees more than headers plus about twenty sample rows; deterministic code does everything at row scale. (For the operator-facing version of this flow, see [Importing data](/docs/importing).)

## The ImportTarget seam

```ts
type ImportTarget<Prep, Value> = {
  key; label; description;
  fields: CanonicalField[];              // schema + aliases + fk kinds
  prepare(ctx): Promise<Prep>;           // load reference caches ONCE per run
  validateRow(mapped, prep): ValidateResult<Value>;   // pure, per-row
  commitRows(rows, ctx, prep): Promise<{ productId? }[]>;  // partial-safe
};
```

Seven targets ride the same pipeline today: `products` (upsert by SKU), `customers` and `vendors` (CRM companies), `price-list` (update prices by SKU), `inventory-count` (set on-hand by SKU), `locations` (warehouses/rooms), and `orders` (line items grouped into draft sales orders). Adding one is a single file; mapping, detection, validation, partial commit, and the error CSV all work for it with zero pipeline changes.

## Add your own type

A new import type is one file plus one line - nothing in the pipeline, the detector, the mapper, or the UI changes. Here is a complete, real target (the `locations` one), start to finish:

```ts
// lib/imports/targets/locations.ts
export const locationsTarget: ImportTarget<Prep, LocationValue> = {
  key: "locations",
  label: "Locations",
  description: "Import a list of physical locations (warehouses, rooms, sites).",
  fields: [
    {
      key: "name",
      label: "Location Name",
      type: "string",
      required: true,
      // aliases let the auto-mapper match arbitrary source columns
      aliases: ["location", "warehouse", "room", "site", "facility", "address"],
    },
  ],
  // load reference caches ONCE per run (not per row)
  async prepare(ctx) {
    const existing = await listLocations(ctx);
    return { existing: new Set(existing.map((l) => l.name.toLowerCase())) };
  },
  // pure, per-row: coerce + validate, return a typed value or errors
  validateRow(mapped) {
    const name = String(mapped.name ?? "").trim();
    if (!name)
      return { ok: false, errors: [{ field: "name", code: "required", message: "Location Name is required" }] };
    return { ok: true, value: { name } };
  },
  // commit a validated batch; partial success is automatic
  async commitRows(rows, ctx, prep) {
    for (const { value } of rows) {
      if (!prep.existing.has(value.name.toLowerCase())) {
        await createLocation(ctx, { name: value.name });
        prep.existing.add(value.name.toLowerCase());
      }
    }
    return rows.map(() => ({ productId: null }));
  },
};
```

Then register it in `lib/imports/registry.ts`:

```ts
const TARGETS = [productsTarget, customersTarget, /* ... */, locationsTarget];
```

That is the whole change. From that moment the agent can **detect** a locations file (the `aliases` feed the scorer), **map** its columns, **validate** every row, **commit** the valid ones, and hand back a **row-mapped error CSV** - and the Copilot can say *"I think this is a locations list, import it?"* about a file it has never seen. A totally different type (purchase orders, COAs, price sheets from a new supplier) is the same three steps: canonical fields, validateRow, commitRows.

## Detect first, never guess

```ts
// scoreTargets(headers) ranks every target by how well its canonical
// fields match the columns. classifyDetection turns scores into intent:
function classifyDetection(headers): Detection {
  const ranked = scoreTargets(headers);
  if (nothing viable)     return { recommendation: "none" };       // refuse
  if (two+ close winners) return { recommendation: "ambiguous" };  // ask which
  return                  { recommendation: "confident" };         // confirm one
}
```

The agent acts on the recommendation and never auto-picks: it confirms on `confident`, asks via `ask_user` on `ambiguous`, and on `none` it refuses and imports zero rows. On real inventory, a wrong guess is worse than a question.

## The stages

| # | Stage | Tools |
|---|---|---|
| 1 | **Upload** - parse CSV/XLSX, persist file, headers, sample, and every row | `POST /api/imports` |
| 2 | **Detect and confirm intent** - score targets, ask, retarget | `detect_import_target`, `set_import_target` |
| 3 | **Map columns** - deterministic baseline, model refines the long tail | `propose_column_mapping`, `set_column_mapping` |
| 4 | **Validate** - chunked at 500; coercion, unknown-unit rejection, new-reference detection; aggregate summary only | `validate_import` |
| 5 | **Commit** - gated; upsert valid and warning rows by SKU, partial success | `commit_import` |
| 6 | **Error report** - row-mapped CSV (`_row`, original columns, `_errors`) | `get_error_report` |

## Scale, 100 to 10,000+ rows

Rows are persisted and processed in chunks; validate and commit are O(rows) with O(1) model calls (mapping only). In this repo the chunking runs in-process within the serverless duration. Beyond 10k, and for the nightly-sheet workflow, the documented path is a queue (QStash / Inngest) driving the exact same chunk functions. No rewrite, because the pipeline is already chunked and job-backed.
