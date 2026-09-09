/**
 * Shared kernel - the cross-cutting primitives every domain module builds on:
 * the tenant-scoped `ServiceCtx` (this is what enforces multitenancy), the
 * Distru-faithful API serializers, and the append-only audit trail. This module
 * depends on nothing else in the domain; everything else depends on it.
 */
export * from "./context";
export * from "./serialize";
export * from "./audit";
export * from "./validate";
