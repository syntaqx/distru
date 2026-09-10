/**
 * Reports module - durable artifacts produced by workflows and the Copilot,
 * plus the Insights report registry (the single source of truth for the standard
 * analytical reports, powering the public API, the Insights UI, and artifacts).
 *
 * Depends on: shared, catalog, inventory, sales, purchasing (cross-domain reads).
 */
export * from "./artifacts";
export * from "./insights-reports";
export * from "./analytics";
