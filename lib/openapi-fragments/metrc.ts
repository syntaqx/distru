/**
 * OpenAPI fragment: Metrc (state compliance) endpoints.
 *
 * These endpoints reflect the org's synced Metrc state. This clone has no live
 * Metrc integration, so lists come back empty and detail lookups 404 until a
 * connection is established — the shapes below are what a connected org returns.
 */

const listOk = {
  description: "A page of Metrc records. Empty until a Metrc connection is established.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/MetrcListEnvelope" },
    },
  },
};

function listOp(summary: string, description: string) {
  return {
    get: {
      tags: ["Metrc"],
      summary,
      description,
      responses: {
        "200": listOk,
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
  };
}

function detailOp(
  summary: string,
  description: string,
  paramName: string,
  paramDescription: string,
) {
  return {
    get: {
      tags: ["Metrc"],
      summary,
      description,
      parameters: [
        {
          name: paramName,
          in: "path",
          required: true,
          description: paramDescription,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "The requested Metrc record.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/MetrcRecord" },
            },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  };
}

export const paths: Record<string, unknown> = {
  "/public/v1/metrc/items": listOp(
    "List Metrc items",
    "Returns the Metrc items synced for the org. Reflects synced Metrc state; empty until a Metrc connection is established.",
  ),
  "/public/v1/metrc/lab-test-batches": listOp(
    "List Metrc lab test batches",
    "Returns the Metrc lab test batches synced for the org. Reflects synced Metrc state; empty until a Metrc connection is established.",
  ),
  "/public/v1/metrc/locations": listOp(
    "List Metrc locations",
    "Returns the Metrc locations synced for the org. Reflects synced Metrc state; empty until a Metrc connection is established.",
  ),
  "/public/v1/metrc/packages": listOp(
    "List Metrc packages",
    "Returns the Metrc packages synced for the org. Reflects synced Metrc state; empty until a Metrc connection is established.",
  ),
  "/public/v1/metrc/packages/{label}": detailOp(
    "Get a Metrc package",
    "Returns a single Metrc package by its tag label. Reflects synced Metrc state; 404 until a Metrc connection is established.",
    "label",
    "The Metrc package tag label.",
  ),
  "/public/v1/metrc/strains": listOp(
    "List Metrc strains",
    "Returns the Metrc strains synced for the org. Reflects synced Metrc state; empty until a Metrc connection is established.",
  ),
  "/public/v1/metrc/tags": listOp(
    "List Metrc tags",
    "Returns the Metrc tags synced for the org. Reflects synced Metrc state; empty until a Metrc connection is established.",
  ),
  "/public/v1/metrc/tags/{id}": detailOp(
    "Get a Metrc tag",
    "Returns a single Metrc tag by id. Reflects synced Metrc state; 404 until a Metrc connection is established.",
    "id",
    "The Metrc tag id.",
  ),
  "/public/v1/metrc/transfers": listOp(
    "List Metrc transfers",
    "Returns the Metrc transfers synced for the org. Reflects synced Metrc state; empty until a Metrc connection is established.",
  ),
  "/public/v1/metrc/transfers/{manifest_number}": detailOp(
    "Get a Metrc transfer",
    "Returns a single Metrc transfer by its manifest number. Reflects synced Metrc state; 404 until a Metrc connection is established.",
    "manifest_number",
    "The Metrc transfer manifest number.",
  ),
};

export const schemas: Record<string, unknown> = {
  MetrcListEnvelope: {
    type: "object",
    description:
      "A page of Metrc records in the standard Distru list envelope. Empty until a Metrc connection is established.",
    properties: {
      data: { type: "array", items: { type: "object" } },
      next_page: { type: ["string", "null"] },
      total: { type: "integer" },
    },
  },
  MetrcRecord: {
    type: "object",
    description:
      "A single Metrc record as synced from state compliance. Shape varies by resource; unavailable until a Metrc connection is established.",
  },
};
