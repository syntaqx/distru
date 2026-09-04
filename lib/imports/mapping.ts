import { anthropic, MODEL, hasAnthropicKey } from "@/lib/anthropic";
import type { ImportTarget } from "./target";
import type { ColumnMapping, MappingEntry } from "./types";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Fast, offline mapping by header/label/alias matching. Always available. */
export function deterministicMapping(
  headers: string[],
  target: ImportTarget,
): ColumnMapping {
  const usedSources = new Set<string>();
  const entries: MappingEntry[] = [];

  for (const field of target.fields) {
    const candidates = [field.key, field.label, ...(field.aliases ?? [])].map(
      normalize,
    );
    let best: { source: string; confidence: number } | null = null;
    for (const header of headers) {
      if (usedSources.has(header)) continue;
      const nh = normalize(header);
      let confidence = 0;
      if (candidates.includes(nh)) confidence = 0.95;
      else if (candidates.some((c) => c && (nh.includes(c) || c.includes(nh))))
        confidence = 0.7;
      if (confidence > 0 && (!best || confidence > best.confidence))
        best = { source: header, confidence };
    }
    if (best) {
      usedSources.add(best.source);
      entries.push({
        targetField: field.key,
        sourceColumn: best.source,
        confidence: best.confidence,
      });
    } else {
      entries.push({ targetField: field.key, sourceColumn: null, confidence: 0 });
    }
  }

  const unmapped = headers.filter((h) => !usedSources.has(h));
  return { entries, unmapped };
}

/**
 * Propose a column mapping. Uses Claude for the long tail (weird headers,
 * combined columns, ambiguous names), seeded with the deterministic guess, and
 * falls back to deterministic mapping if the model is unavailable or errors.
 */
export async function proposeMapping(
  headers: string[],
  sampleRows: Record<string, unknown>[],
  target: ImportTarget,
): Promise<ColumnMapping> {
  const baseline = deterministicMapping(headers, target);
  if (!hasAnthropicKey()) return baseline;

  const fieldDocs = target.fields
    .map(
      (f) =>
        `- ${f.key} (${f.label})${f.required ? " [required]" : ""}: ${f.type}` +
        (f.enumValues ? ` one of ${f.enumValues.join(", ")}` : "") +
        (f.aliases?.length ? ` - aliases: ${f.aliases.join(", ")}` : ""),
    )
    .join("\n");

  const sample = sampleRows.slice(0, 8);

  const tool = {
    name: "propose_mapping",
    description:
      "Map each source column to at most one canonical target field key, or null if it has no good target.",
    input_schema: {
      type: "object" as const,
      properties: {
        mappings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source_column: { type: "string" },
              target_field: {
                type: ["string", "null"],
                description: "canonical field key, or null",
              },
              confidence: { type: "number" },
              transform: {
                type: ["string", "null"],
                description: "short note if a value transform is needed",
              },
            },
            required: ["source_column", "target_field", "confidence", "transform"],
            additionalProperties: false,
          },
        },
      },
      required: ["mappings"],
      additionalProperties: false,
    },
  };

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tools: [tool],
      tool_choice: { type: "tool", name: "propose_mapping" },
      messages: [
        {
          role: "user",
          content:
            `You are mapping a customer's spreadsheet columns to Distru's canonical ` +
            `"${target.label}" import schema.\n\nCanonical fields:\n${fieldDocs}\n\n` +
            `Source columns: ${JSON.stringify(headers)}\n\n` +
            `Sample rows (first ${sample.length}):\n${JSON.stringify(sample, null, 2)}\n\n` +
            `Map each source column to the best canonical field key (or null). ` +
            `Use the sample values, not just the header names. Never map two source ` +
            `columns to the same target field - pick the best one.`,
        },
      ],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return baseline;
    const input = block.input as {
      mappings: {
        source_column: string;
        target_field: string | null;
        confidence: number;
        transform: string | null;
      }[];
    };

    // Reconcile into one entry per canonical field, best confidence wins.
    const bySource = new Map(input.mappings.map((m) => [m.source_column, m]));
    const usedSources = new Set<string>();
    const entries: MappingEntry[] = target.fields.map((field) => {
      let best: {
        source: string;
        confidence: number;
        transform?: string;
      } | null = null;
      for (const m of input.mappings) {
        if (m.target_field !== field.key || !m.source_column) continue;
        if (usedSources.has(m.source_column)) continue;
        if (!best || m.confidence > best.confidence)
          best = {
            source: m.source_column,
            confidence: m.confidence,
            transform: m.transform ?? undefined,
          };
      }
      // Fall back to deterministic guess for required fields the model missed.
      if (!best) {
        const det = baseline.entries.find((e) => e.targetField === field.key);
        if (det?.sourceColumn && !usedSources.has(det.sourceColumn)) {
          best = { source: det.sourceColumn, confidence: det.confidence };
        }
      }
      if (best) {
        usedSources.add(best.source);
        return {
          targetField: field.key,
          sourceColumn: best.source,
          confidence: Math.round(best.confidence * 100) / 100,
          transform: best.transform,
        };
      }
      return { targetField: field.key, sourceColumn: null, confidence: 0 };
    });

    const unmapped = headers.filter((h) => !usedSources.has(h) && !bySource.get(h)?.target_field);
    return { entries, unmapped };
  } catch (err) {
    console.error("[mapping] LLM mapping failed, using deterministic", err);
    return baseline;
  }
}
