/**
 * OpenAPI fragment: nested action endpoints.
 *
 * These are the "verb" routes hanging off core resources (record a payment,
 * attach an image, list a company's licenses) plus the Metrc/manufacturing
 * actions this clone accepts but defers (add-costs, finish, move, split, etc.).
 */

const ok200 = {
  "200": {
    description: "Success.",
    content: { "application/json": { schema: { type: "object" } } },
  },
} as const;

const unauthorized = { $ref: "#/components/responses/Unauthorized" };
const notFound = { $ref: "#/components/responses/NotFound" };

function idParam(description: string) {
  return [
    {
      name: "id",
      in: "path",
      required: true,
      description,
      schema: { type: "string" },
    },
  ];
}

/** An accept-and-echo action whose full processing is deferred in this clone. */
function echoAction(summary: string, description: string) {
  return {
    post: {
      tags: ["Actions"],
      summary,
      description,
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { type: "object", additionalProperties: true },
          },
        },
      },
      responses: {
        "200": {
          description: "Accepted. Full processing is deferred in this clone.",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "401": unauthorized,
      },
    },
  };
}

export const paths: Record<string, unknown> = {
  "/public/v1/invoices/{id}/payments": {
    get: {
      tags: ["Actions"],
      summary: "List invoice payments",
      description: "List the payments recorded against an invoice.",
      parameters: idParam("The invoice id."),
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
    post: {
      tags: ["Actions"],
      summary: "Record an invoice payment",
      description: "Record a payment against an invoice and roll its status forward.",
      parameters: idParam("The invoice id."),
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RecordPaymentRequest" },
          },
        },
      },
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
  },

  "/public/v1/payments/{id}/void": {
    post: {
      tags: ["Actions"],
      summary: "Void a payment",
      description:
        "Void a recorded payment. Not supported in this build (payments are an immutable ledger); returns 422.",
      parameters: idParam("The payment id."),
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
  },

  "/public/v1/products/{id}/images": {
    get: {
      tags: ["Actions"],
      summary: "List product images",
      description: "List the images attached to a product.",
      parameters: idParam("The product id."),
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
    post: {
      tags: ["Actions"],
      summary: "Attach a product image",
      description:
        "Attach an image to a product. The url may be a data URL or an http(s) URL and is stored as-is.",
      parameters: idParam("The product id."),
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AddProductImageRequest" },
          },
        },
      },
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
  },

  "/public/v1/companies/{id}/licenses": {
    get: {
      tags: ["Actions"],
      summary: "List company licenses",
      description:
        "List a company's licenses. Licenses are org-scoped in this clone, so the organization's licenses are returned.",
      parameters: idParam("The company id."),
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
  },

  "/public/v1/companies/{id}/locations": {
    get: {
      tags: ["Actions"],
      summary: "List company locations",
      description:
        "List a company's locations. Locations are org-scoped in this clone, so the organization's locations are returned.",
      parameters: idParam("The company id."),
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
  },

  "/public/v1/purchases/{id}/payments": {
    get: {
      tags: ["Actions"],
      summary: "List purchase order payments",
      description:
        "List payments against a purchase order. Not supported in this build; returns 422.",
      parameters: idParam("The purchase order id."),
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
    post: {
      tags: ["Actions"],
      summary: "Record a purchase order payment",
      description:
        "Record a payment against a purchase order. Not supported in this build; returns 422.",
      parameters: idParam("The purchase order id."),
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { type: "object", additionalProperties: true },
          },
        },
      },
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
  },

  "/public/v1/credits/{id}/cancel": {
    post: {
      tags: ["Actions"],
      summary: "Cancel a credit",
      description:
        "Cancel a credit. Accepted and echoed; full cancellation processing is deferred in this clone.",
      parameters: idParam("The credit id."),
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: { type: "object", additionalProperties: true },
          },
        },
      },
      responses: { ...ok200, "401": unauthorized, "404": notFound },
    },
  },

  "/public/v1/products/add-costs": echoAction(
    "Add product costs",
    "Attach cost entries to products. Accepted and echoed; full processing is deferred in this clone.",
  ),
  "/public/v1/packages/add-costs": echoAction(
    "Add package costs",
    "Attach cost entries to packages. Accepted and echoed; full processing is deferred in this clone.",
  ),
  "/public/v1/batches/add-costs": echoAction(
    "Add batch costs",
    "Attach cost entries to batches. Accepted and echoed; full processing is deferred in this clone.",
  ),
  "/public/v1/packages/finish": echoAction(
    "Finish packages",
    "Mark Metrc packages as finished. Accepted and echoed; full processing is deferred in this clone.",
  ),
  "/public/v1/packages/move": echoAction(
    "Move packages",
    "Move Metrc packages between locations. Accepted and echoed; full processing is deferred in this clone.",
  ),
  "/public/v1/assemblies/split_package": echoAction(
    "Split a package",
    "Split a package into a new one. Accepted and echoed; full processing is deferred in this clone.",
  ),
  "/public/v1/assemblies/create_test_sample": echoAction(
    "Create a test sample",
    "Create a test sample package. Accepted and echoed; full processing is deferred in this clone.",
  ),
};

export const schemas: Record<string, unknown> = {
  RecordPaymentRequest: {
    type: "object",
    required: ["amount"],
    properties: {
      amount: { type: "number", description: "Payment amount; must be positive." },
      method: { type: "string", description: "Payment method (defaults to cash)." },
      reference: { type: "string", nullable: true, description: "Optional external reference." },
    },
  },
  AddProductImageRequest: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "A data URL or an http(s) URL." },
    },
  },
};
