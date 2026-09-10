/**
 * Manufacturing context - assemblies (production runs that consume input
 * inventory and yield output products) plus the cost model. Distru's Make
 * module. Reads and upserts today; posting the input/output inventory movements
 * is a documented follow-up.
 */
export * from "./assemblies";
export * from "./reservations";
export * from "./costs";
