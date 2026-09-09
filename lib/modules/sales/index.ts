/**
 * Sales module - the revenue side of the catalog: orders, invoices, payments.
 * Confirming an order decrements the inventory ledger (restored on cancel); an
 * invoice snapshots an order's total and rolls OPEN → PARTIAL → PAID.
 *
 * Depends on: shared, inventory, catalog.
 */
export * from "./orders";
export * from "./invoices";
export * from "./returns";
export * from "./analytics";
export * from "./config";
