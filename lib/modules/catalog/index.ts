/**
 * Catalog module - products plus their reference data (categories, companies
 * acting as vendor/brand/customer, locations, and the global unit-type set).
 * Import from this barrel, never from the files inside.
 *
 * Depends on: shared.
 */
export * from "./products";
export * from "./reference";
export * from "./depth";
