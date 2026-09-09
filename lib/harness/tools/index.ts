import { registerTools } from "../registry";
import { catalogTools } from "./catalog";
import { mutationTools } from "./mutations";
import { salesTools } from "./sales";
import { analyticsTools } from "./analytics";
import { importTools } from "./imports";
import { docsTools } from "./docs";
import { workflowTools } from "./workflows";
import { cultivationTools } from "./cultivation";
import { purchasingTools } from "./purchasing";
import { manufacturingTools } from "./manufacturing";
import { complianceTools } from "./compliance";
import { reportTools } from "./reports";
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
    ...cultivationTools,
    ...purchasingTools,
    ...manufacturingTools,
    ...complianceTools,
    ...reportTools,
    askUser,
  ]);
  registered = true;
}
