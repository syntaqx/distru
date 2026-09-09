/**
 * Purchasing module - the buy side of the platform. A purchase order buys line
 * items from a vendor; receiving it increments the inventory ledger (the mirror
 * of a sales order's decrement).
 *
 * Depends on: shared, inventory, catalog. Nothing depends on purchasing.
 */
export * from "./purchase-orders";
