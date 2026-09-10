import { registerTools } from "../registry";
import { catalogTools } from "./catalog";
import { mutationTools } from "./mutations";
import { inventoryTools } from "./inventory";
import { taskTools } from "./tasks";
import { integrationTools } from "./integrations";
import { salesTools } from "./sales";
import { analyticsTools } from "./analytics";
import { importTools } from "./imports";
import { docsTools } from "./docs";
import { workflowTools } from "./workflows";
import { cultivationTools } from "./cultivation";
import { purchasingTools } from "./purchasing";
import { manufacturingTools } from "./manufacturing";
import { schedulingTools } from "./scheduling";
import { complianceTools } from "./compliance";
import { growTools } from "./grow";
import { logisticsTools } from "./logistics";
import { dispatchTools } from "./dispatch";
import { crmTools } from "./crm";
import { reportTools } from "./reports";
import { askUser } from "./ask";

let registered = false;

/** Register all built-in tools exactly once (idempotent across hot reloads). */
export function ensureToolsRegistered() {
  if (registered) return;
  registerTools([
    ...catalogTools,
    ...mutationTools,
    ...inventoryTools,
    ...taskTools,
    ...integrationTools,
    ...salesTools,
    ...analyticsTools,
    ...importTools,
    ...docsTools,
    ...workflowTools,
    ...cultivationTools,
    ...purchasingTools,
    ...manufacturingTools,
    ...schedulingTools,
    ...complianceTools,
    ...growTools,
    ...logisticsTools,
    ...dispatchTools,
    ...crmTools,
    ...reportTools,
    askUser,
  ]);
  registered = true;
}
