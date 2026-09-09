/**
 * Extra OpenAPI paths/schemas for the fuller-parity surface (reports, Metrc,
 * PDF, nested actions, misc), each contributed by its own fragment file so the
 * subsystems stay independently editable. Merged into the spec in `openapi.ts`.
 */
import * as reports from "./openapi-fragments/reports";
import * as metrc from "./openapi-fragments/metrc";
import * as pdf from "./openapi-fragments/pdf";
import * as actions from "./openapi-fragments/actions";
import * as misc from "./openapi-fragments/misc";

type Rec = Record<string, unknown>;

export const EXTRA_PATHS: Rec = {
  ...reports.paths,
  ...metrc.paths,
  ...pdf.paths,
  ...actions.paths,
  ...misc.paths,
};

export const EXTRA_SCHEMAS: Rec = {
  ...reports.schemas,
  ...metrc.schemas,
  ...pdf.schemas,
  ...actions.schemas,
  ...misc.schemas,
};
