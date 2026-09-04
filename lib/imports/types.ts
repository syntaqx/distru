/** Import framework shared types. */

export type CanonicalFieldType =
  | "string"
  | "number"
  | "enum"
  | "reference"
  | "boolean";

/** One field in an ImportTarget's canonical schema. */
export type CanonicalField = {
  key: string;
  label: string;
  type: CanonicalFieldType;
  required: boolean;
  description?: string;
  /** For enum fields: the allowed uppercase values. */
  enumValues?: string[];
  /** For reference fields: the entity kind resolved against (category, company, unitType). */
  referenceKind?: "category" | "company" | "unitType";
  /** Aliases that help auto-mapping match source columns. */
  aliases?: string[];
};

/** One source-column → canonical-field mapping decision. */
export type MappingEntry = {
  targetField: string;
  sourceColumn: string | null;
  confidence: number;
  /** Human-readable note about a transform, e.g. "strip $ and parse number". */
  transform?: string;
};

export type ColumnMapping = {
  entries: MappingEntry[];
  /** Source columns that were not mapped to any canonical field. */
  unmapped: string[];
};

export type RowError = {
  field?: string;
  code?: string;
  message: string;
};

export type ValidationSummary = {
  total: number;
  valid: number;
  warning: number;
  error: number;
  /** Top error reasons with counts, for the agent to summarize. */
  topErrors: { message: string; count: number }[];
  /** New reference values discovered that don't exist yet (offer to create). */
  newReferences: { kind: string; values: string[] }[];
};
