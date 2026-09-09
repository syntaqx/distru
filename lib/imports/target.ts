import type { ServiceCtx } from "@/lib/modules/shared";
import type { CanonicalField, RowError } from "./types";

export type NewReference = { kind: string; value: string };

export type ValidateResult<Value> =
  | { ok: true; value: Value; warnings?: RowError[]; newRefs?: NewReference[] }
  | { ok: false; errors: RowError[]; newRefs?: NewReference[] };

/**
 * An ImportTarget teaches the generic pipeline how to turn arbitrary mapped rows
 * into one kind of Distru entity. Register a new target (customers, purchase
 * orders, ...) and the whole import experience - mapping, validation, partial
 * commit, error CSV - works for it with no pipeline changes.
 *
 * `Prep` is loaded once per run (reference caches) and threaded through so that
 * validating/committing 10k rows costs a handful of queries, not 10k.
 */
export type ImportTarget<Prep = unknown, Value = unknown> = {
  key: string;
  label: string;
  description: string;
  fields: CanonicalField[];
  /** Load reference caches once before validating/committing. */
  prepare(ctx: ServiceCtx): Promise<Prep>;
  /** Pure validation of a single mapped row against the canonical schema. */
  validateRow(mapped: Record<string, unknown>, prep: Prep): ValidateResult<Value>;
  /** Commit a batch of validated rows; returns per-index outcome. */
  commitRows(
    rows: { value: Value }[],
    ctx: ServiceCtx,
    prep: Prep,
  ): Promise<{ productId?: string | null }[]>;
};
