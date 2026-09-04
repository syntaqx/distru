import { registerTools } from "../registry";
import { catalogTools } from "./catalog";
import { mutationTools } from "./mutations";
import { importTools } from "./imports";
import { askUser } from "./ask";

let registered = false;

/** Register all built-in tools exactly once (idempotent across hot reloads). */
export function ensureToolsRegistered() {
  if (registered) return;
  registerTools([...catalogTools, ...mutationTools, ...importTools, askUser]);
  registered = true;
}
