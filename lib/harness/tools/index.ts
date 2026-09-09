import { registerTools } from "../registry";
import { catalogTools } from "./catalog";
import { mutationTools } from "./mutations";
import { salesTools } from "./sales";
import { analyticsTools } from "./analytics";
import { importTools } from "./imports";
import { docsTools } from "./docs";
import { workflowTools } from "./workflows";
import { askUser } from "./ask";

let registered = false;

/** Register all built-in tools exactly once (idempotent across hot reloads). */
export function ensureToolsRegistered() {
  if (registered) return;
  registerTools([
    ...catalogTools,
    ...mutationTools,
    ...salesTools,
    ...analyticsTools,
    ...importTools,
    ...docsTools,
    ...workflowTools,
    askUser,
  ]);
  registered = true;
}
