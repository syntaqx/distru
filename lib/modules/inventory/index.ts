/**
 * Inventory module - on-hand stock as an append-only ledger, so a product's
 * quantity is `SUM(quantityDelta)` and every movement is auditable.
 *
 * Depends on: shared.
 */
export * from "./inventory";
export * from "./costing";
export * from "./depth";
export * from "./transfers";
