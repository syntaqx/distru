/**
 * OpenAPI fragment: misc endpoints — inventory snapshot, org users, single
 * inventory adjustment, and product/POS mappings.
 *
 * Inventory, users, and adjustment lookups return real data. POS mappings are
 * not modeled in this clone, so they come back empty (list) or 404 (detail).
 */

const idParam = {
  name: "id",
  in: "path",
  required: true,
  description: "The resource id.",
  schema: { type: "string" },
};

export const paths: Record<string, unknown> = {
  "/public/v1/inventory": {
    get: {
      tags: ["Inventory"],
      summary: "Inventory on-hand snapshot",
      description:
        "Returns an on-hand snapshot across active products at the org's default location. Quantities are strings.",
      responses: {
        "200": {
          description:
            "A page of on-hand rows: { product_id, sku, name, location, quantity } in the standard Distru list envelope.",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },
  "/public/v1/users": {
    get: {
      tags: ["Users"],
      summary: "List users",
      description: "Lists the users/members of the authenticated org.",
      responses: {
        "200": {
          description:
            "A page of members: { id, name, email, role, inserted_datetime } in the standard Distru list envelope.",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },
  "/public/v1/users/{id}": {
    get: {
      tags: ["Users"],
      summary: "Get a user",
      description: "Returns a single member of the org by user id.",
      parameters: [{ ...idParam, description: "The user id." }],
      responses: {
        "200": {
          description: "The member: { id, name, email, role, inserted_datetime }.",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/public/v1/adjustments/{id}": {
    get: {
      tags: ["Inventory"],
      summary: "Get an inventory adjustment",
      description:
        "Returns a single inventory adjustment (a movement in the append-only ledger) by id. The delta is a string.",
      parameters: [{ ...idParam, description: "The inventory adjustment id." }],
      responses: {
        "200": {
          description:
            "The adjustment: { id, product_id, location, quantity_delta, reason, inserted_datetime }.",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
  "/public/v1/product-pos-mappings": {
    get: {
      tags: ["Misc"],
      summary: "List product/POS mappings",
      description:
        "POS mappings are not modeled in this clone; this always returns an empty list.",
      responses: {
        "200": {
          description: "An empty list envelope: { data: [], next_page: null, total: 0 }.",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
    post: {
      tags: ["Misc"],
      summary: "Create a product/POS mapping",
      description:
        "Validates the body and acknowledges. POS mappings are not modeled in this clone, so nothing is persisted.",
      responses: {
        "200": {
          description: "Acknowledgement: { data: { accepted: true } }.",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
  },
  "/public/v1/product-pos-mappings/{id}": {
    get: {
      tags: ["Misc"],
      summary: "Get a product/POS mapping",
      description:
        "POS mappings are not modeled in this clone, so this always returns 404.",
      parameters: [{ ...idParam, description: "The POS mapping id." }],
      responses: {
        "200": {
          description: "The POS mapping (never returned in this clone).",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "404": { $ref: "#/components/responses/NotFound" },
      },
    },
  },
};

export const schemas: Record<string, unknown> = {};
