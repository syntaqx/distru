/**
 * The tenant-scoped context every service function takes. This is what enforces
 * multitenancy: services only ever touch rows for `orgId`, and every mutation is
 * attributed to `actor` in the audit log + inventory ledger.
 *
 * The same shape is built by all five "faces": chat agent, public REST API, MCP
 * server, the /upload-products engine, and (future) workflows.
 */
export type ActorType = "user" | "agent" | "api" | "system" | "import";

export type ServiceCtx = {
  orgId: string;
  actor: string;
  actorType: ActorType;
};

export function systemCtx(orgId: string): ServiceCtx {
  return { orgId, actor: "system", actorType: "system" };
}
