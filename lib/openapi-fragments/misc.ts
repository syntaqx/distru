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

const unauthorized = { $ref: "#/components/responses/Unauthorized" };
const notFound = { $ref: "#/components/responses/NotFound" };
const okObject = {
  "200": {
    description: "Success.",
    content: { "application/json": { schema: { type: "object" } } },
  },
} as const;

export const paths: Record<string, unknown> = {
  "/api/v1/transfers": {
    get: {
      tags: ["Inventory"],
      summary: "List stock transfers",
      description:
        "Lists multi-location stock transfers (transfer number, from/to location, lines) in the standard Distru list envelope.",
      responses: { ...okObject, "401": unauthorized },
    },
    post: {
      tags: ["Inventory"],
      summary: "Create a stock transfer",
      description:
        "Creates and executes a stock transfer between two locations. Each line FIFO-issues from the source and re-receives into the destination at the same per-lot cost; a line exceeding on-hand returns 422.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/CreateTransferRequest" },
          },
        },
      },
      responses: { ...okObject, "400": okObject["200"], "401": unauthorized },
    },
  },
  "/api/v1/transfers/{id}": {
    get: {
      tags: ["Inventory"],
      summary: "Get a stock transfer",
      description: "Returns a single stock transfer with its lines by id.",
      parameters: [{ ...idParam, description: "The transfer id." }],
      responses: { ...okObject, "401": unauthorized, "404": notFound },
    },
  },
  "/api/v1/transfers/{id}/manifest/pdf": {
    get: {
      tags: ["Inventory"],
      summary: "Transfer manifest PDF",
      description:
        "Renders a Metrc-style transfer manifest (shipping/receiving locations + line items) for a stock transfer as a PDF.",
      parameters: [{ ...idParam, description: "The transfer id." }],
      responses: {
        "200": {
          description: "A PDF document.",
          content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
        },
        "401": unauthorized,
        "404": notFound,
      },
    },
  },
  "/api/v1/inventory/lots": {
    get: {
      tags: ["Inventory"],
      summary: "List FIFO cost layers",
      description:
        "The FIFO cost layers behind on-hand: lot number, product/location, unit cost, original vs. remaining quantity, source. Filter with product_id, location_id, and open_only (default true).",
      parameters: [
        { name: "product_id", in: "query", required: false, schema: { type: "string" } },
        { name: "location_id", in: "query", required: false, schema: { type: "string" } },
        { name: "open_only", in: "query", required: false, schema: { type: "boolean" } },
      ],
      responses: { ...okObject, "401": unauthorized },
    },
  },
  "/api/v1/inventory/scan": {
    get: {
      tags: ["Inventory"],
      summary: "Scan lookup",
      description:
        "Resolves a scanned code (package tag, Metrc tag, barcode, serial number, or product SKU/barcode) to the package or product it identifies, with on-hand.",
      parameters: [
        {
          name: "code",
          in: "query",
          required: true,
          description: "The scanned code.",
          schema: { type: "string" },
        },
      ],
      responses: { ...okObject, "400": okObject["200"], "401": unauthorized },
    },
  },
  "/api/v1/inventory": {
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
  "/api/v1/users": {
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
  "/api/v1/users/{id}": {
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
  "/api/v1/adjustments/{id}": {
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
  "/api/v1/product-pos-mappings": {
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
  "/api/v1/product-pos-mappings/{id}": {
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

export const schemas: Record<string, unknown> = {
  CreateTransferRequest: {
    type: "object",
    required: ["from_location_id", "to_location_id", "lines"],
    properties: {
      from_location_id: { type: "string", description: "Source location id." },
      to_location_id: { type: "string", description: "Destination location id." },
      notes: { type: "string", nullable: true },
      lines: {
        type: "array",
        items: {
          type: "object",
          required: ["product_id", "quantity"],
          properties: {
            product_id: { type: "string" },
            quantity: { type: "number" },
          },
        },
      },
    },
  },
};
