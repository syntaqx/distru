/**
 * OpenAPI 3.1 description of Distru's public REST API, served at
 * /api/openapi.json and /api/openapi.yaml. Grounded in the actual /public/v1
 * routes and their Distru-faithful conventions (Bearer auth, string-numbers,
 * page[number] pagination with a next_page URL (page[after] also accepted as an
 * opaque cursor), uppercase enums, sparse upsert, { errors: [...] } envelope).
 * Kept in one place so both formats stay in sync.
 *
 * The `npm run check:openapi` drift guard (run on every build) asserts this spec
 * documents EXACTLY the routes on disk under app/public/v1 - so a new endpoint
 * can't ship undocumented. To intentionally leave one out (a health probe, an
 * internal endpoint), add its OpenAPI path to OPENAPI_IGNORE below; the guard
 * treats it as a deliberate opt-out instead of a failure.
 */

/**
 * Public routes intentionally left OUT of the OpenAPI spec. Every other route
 * under app/public/v1 must be documented or the build fails. Use the OpenAPI
 * path form (e.g. "/public/v1/health").
 */
export const OPENAPI_IGNORE: readonly string[] = [
  "/public/v1/health", // liveness probe - operational, not part of the API contract
];

const ref = {
  anyOf: [
    {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
      },
    },
    { type: "null" },
  ],
} as const;

import { EXTRA_PATHS, EXTRA_SCHEMAS } from "./openapi-extra";

export function buildOpenApiSpec(baseUrl: string): Record<string, unknown> {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Distru Public API",
      version: "1.0.0",
      description: [
        "The Distru public REST API operates your entire workspace — catalog, inventory, sales, purchasing, manufacturing, compliance, cultivation, and more. Every response is the same data the in-app Copilot, the MCP server, and the bulk importer read and write: **one service layer, many faces.**",
        "",
        "## Authentication",
        "All requests require a Bearer token. Mint one in the app under **Settings → API tokens**, then send it on every request:",
        "```http",
        "Authorization: Bearer dk_live_xxxxxxxxxxxxxxxxxxxx",
        "```",
        "Tokens are org-scoped and stored hashed. Unauthenticated requests get `401`.",
        "",
        "## Base URL & conventions",
        "- **Base URL:** `" + baseUrl + "/public/v1`",
        "- **IDs** are UUIDs.",
        "- **Numbers** (money, quantities) are serialized as **strings** with fixed precision, e.g. `\"25.000000\"`.",
        "- **Datetimes** are ISO-8601 with microseconds and a `Z` suffix; the universal created key is `inserted_datetime`.",
        "- **Enums** are UPPERCASE.",
        "- **Nulls** are always present (a field is `null`, never omitted).",
        "",
        "## Pagination",
        "List endpoints page with `page[number]` (1-based) and echo a `next_page` URL you can follow for the next page. An opaque cursor `page[after]` is also accepted.",
        "```http",
        "GET /public/v1/products?page[number]=2",
        "```",
        "",
        "## Filtering",
        "Many lists accept filters like `search`, a name/category/vendor filter, a `status` enum, and `updated_datetime` as an inclusive comma-delimited range (`start,end`, either side optional).",
        "",
        "## Writes & sparse upsert",
        "Write endpoints are **sparse upserts**: omit `id` to create, include `id` to update, and only the fields you send change. Send `null` to clear a nullable field.",
        "",
        "## Errors",
        "Errors use a consistent envelope with a machine-readable pointer:",
        "```json",
        '{ "errors": [{ "message": "quantity_delta is required", "pointer": ["quantity_delta"], "section": "body" }] }',
        "```",
        "Common statuses: `400` bad request, `401` unauthorized, `404` not found, `422` unsupported operation.",
        "",
        "## The other faces",
        "- **Bulk uploader** — `POST /api/upload-products` (multipart CSV/XLSX): chunked detect → map → validate → partial commit → row-mapped error CSV.",
        "- **MCP server** — `POST /api/mcp` (JSON-RPC over Streamable HTTP): drive Distru from Claude Code, Claude Desktop, or Cursor with the same tool surface as the in-app Copilot.",
        "- **Webhooks** — HMAC-signed event deliveries you configure under Settings → Webhooks.",
      ].join("\n"),
    },
    servers: [{ url: baseUrl }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Products" },
      { name: "Companies" },
      { name: "Categories" },
      { name: "Inventory" },
      { name: "Orders" },
      { name: "Invoices" },
      { name: "Purchasing" },
      { name: "Returns" },
      { name: "Payments" },
      { name: "Contacts" },
      { name: "Reference" },
      { name: "Catalog" },
      { name: "Sales config" },
      { name: "Manufacturing" },
      { name: "Compliance" },
      { name: "Logistics" },
      { name: "Platform" },
    ],
    paths: {
      "/public/v1/products": {
        get: {
          tags: ["Products"],
          summary: "List products",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
            { name: "status", in: "query", schema: { type: "string", enum: ["ACTIVE", "ARCHIVED"] } },
            { name: "category", in: "query", schema: { type: "string" }, description: "Category name filter." },
            { name: "vendor", in: "query", schema: { type: "string" }, description: "Vendor/brand name filter." },
            { name: "search", in: "query", schema: { type: "string" }, description: "Matches name or SKU." },
            { name: "updated_datetime", in: "query", schema: { type: "string" }, description: "Inclusive datetime range, comma-delimited: start,end (either side optional)." },
          ],
          responses: {
            "200": {
              description: "A page of products.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProductList" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Products"],
          summary: "Create or update a product (sparse upsert)",
          description:
            "Omit `id` to create; include `id` (or a matching `sku`) to update. Only " +
            "fields you send change. References accept either an id (`category_id`) or " +
            "a name (`category`, created on demand).",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProductUpsert" } } },
          },
          responses: {
            "200": {
              description: "The updated product (when it already existed).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProductEnvelope" } } },
            },
            "201": {
              description: "The created product.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProductEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/products/{id}": {
        get: {
          tags: ["Products"],
          summary: "Get a product by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "The product.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProductEnvelope" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/companies": {
        get: {
          tags: ["Companies"],
          summary: "List companies (customers, vendors, brands)",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
          ],
          responses: {
            "200": {
              description: "A page of companies.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyList" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Companies"],
          summary: "Create or update a company (sparse upsert)",
          description: "Omit `id` to create; include `id` to update. Only the fields you send change.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyUpsert" } } },
          },
          responses: {
            "200": {
              description: "The updated company (when `id` was supplied).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyEnvelope" } } },
            },
            "201": {
              description: "The created company.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/companies/{id}": {
        get: {
          tags: ["Companies"],
          summary: "Get a company by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "The company.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyEnvelope" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/product-categories": {
        get: {
          tags: ["Categories"],
          summary: "List categories",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
          ],
          responses: {
            "200": {
              description: "A page of categories.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryList" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Categories"],
          summary: "Create a category",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryCreate" } } },
          },
          responses: {
            "201": {
              description: "The created category.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/adjustments": {
        get: {
          tags: ["Inventory"],
          summary: "List stock adjustments",
          description:
            "Lists inventory movements (Distru StockAdjustments) newest-first: product, location, quantity, unit cost, reason, source, in the standard Distru list envelope.",
          responses: {
            "200": {
              description: "A page of adjustments.",
              content: { "application/json": { schema: { type: "object" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Inventory"],
          summary: "Post a stock adjustment",
          description:
            "Move on-hand by a signed `quantity_delta` (or Distru's `quantity`) for a target " +
            "identified by `product_id`/`sku`, `package_id`, or `batch_id`, at a location " +
            "(default if omitted). A positive delta may open a cost layer via `unit_cost`.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/StockAdjustmentCreate" } } },
          },
          responses: {
            "201": {
              description: "The applied adjustment and resulting on-hand.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/StockAdjustmentEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/orders": {
        get: {
          tags: ["Orders"],
          summary: "List sales orders",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
            { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "PROCESSING", "READY_TO_SHIP", "DELIVERING", "DELIVERED", "COMPLETED", "CANCELED"] } },
            { name: "search", in: "query", schema: { type: "string" }, description: "Matches order number." },
            { name: "updated_datetime", in: "query", schema: { type: "string" }, description: "Inclusive datetime range, comma-delimited: start,end (either side optional)." },
          ],
          responses: {
            "200": {
              description: "A page of orders.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/OrderList" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Orders"],
          summary: "Create a sales order",
          description:
            "Create an order for a customer (by `customer_id` or `customer` name, created " +
            "if new). Each line matches a product by `product_id` or `sku`; `unit_price` " +
            "defaults to the product's price. A PROCESSING order (the default) decrements " +
            "inventory; pass `status: PENDING` to hold stock.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/OrderCreate" } } },
          },
          responses: {
            "201": {
              description: "The created order.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/OrderEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/orders/{id}": {
        get: {
          tags: ["Orders"],
          summary: "Get an order by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "The order.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/OrderEnvelope" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/invoices": {
        get: {
          tags: ["Invoices"],
          summary: "List invoices",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
            { name: "status", in: "query", schema: { type: "string", enum: ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID", "OVER_PAID"] } },
            { name: "search", in: "query", schema: { type: "string" }, description: "Matches invoice number." },
            { name: "updated_datetime", in: "query", schema: { type: "string" }, description: "Inclusive datetime range, comma-delimited: start,end (either side optional)." },
          ],
          responses: {
            "200": {
              description: "A page of invoices.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/InvoiceList" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Invoices"],
          summary: "Create an invoice for an order",
          description:
            "Invoice an existing order (by `order_id` or `order_number`), snapshotting its " +
            "total. Optionally record an initial `payment`.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/InvoiceCreate" } } },
          },
          responses: {
            "201": {
              description: "The created invoice.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/InvoiceEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/invoices/{id}": {
        get: {
          tags: ["Invoices"],
          summary: "Get an invoice by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "The invoice.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/InvoiceEnvelope" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/purchases": {
        get: {
          tags: ["Purchasing"],
          summary: "List purchase orders",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
            { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "OPEN", "RECEIVED", "CANCELED"] } },
            { name: "search", in: "query", schema: { type: "string" }, description: "Matches PO number." },
            { name: "updated_datetime", in: "query", schema: { type: "string" }, description: "Inclusive datetime range, comma-delimited: start,end (either side optional)." },
          ],
          responses: {
            "200": {
              description: "A page of purchase orders.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseOrderList" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Purchasing"],
          summary: "Create a purchase order",
          description:
            "Buy from a vendor (by `vendor_id` or `vendor` name, created if new). Each " +
            "line matches a product by `product_id` or `sku`. A RECEIVED purchase order " +
            "(the default is OPEN) increments inventory.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseOrderCreate" } } },
          },
          responses: {
            "201": {
              description: "The created purchase order.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseOrderEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/purchases/{id}": {
        get: {
          tags: ["Purchasing"],
          summary: "Get a purchase order by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "The purchase order.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/PurchaseOrderEnvelope" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/returns": {
        get: {
          tags: ["Returns"],
          summary: "List returns",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
            { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "RECEIVED", "CANCELED"] } },
            { name: "search", in: "query", schema: { type: "string" }, description: "Matches return number." },
            { name: "updated_datetime", in: "query", schema: { type: "string" }, description: "Inclusive datetime range, comma-delimited: start,end (either side optional)." },
          ],
          responses: {
            "200": {
              description: "A page of returns.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ReturnList" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Returns"],
          summary: "Create a customer return",
          description:
            "Record a customer return, optionally linked to the original order (by " +
            "`order_number`). Each line matches a product by `product_id` or `sku`. A " +
            "RECEIVED return (the default) restocks inventory.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ReturnCreate" } } },
          },
          responses: {
            "201": {
              description: "The created return.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ReturnEnvelope" } } },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/returns/{id}": {
        get: {
          tags: ["Returns"],
          summary: "Get a return by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": {
              description: "The return.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ReturnEnvelope" } } },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/payments": {
        get: {
          tags: ["Payments"],
          summary: "List payments",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
          ],
          responses: {
            "200": { description: "A page of payments.", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentList" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/payments/{id}": {
        get: {
          tags: ["Payments"],
          summary: "Get a payment by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The payment.", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentEnvelope" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/contacts": {
        get: {
          tags: ["Contacts"],
          summary: "List contacts",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
            { name: "company_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "search", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "A page of contacts.", content: { "application/json": { schema: { $ref: "#/components/schemas/ContactList" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Contacts"],
          summary: "Create or update a contact (sparse upsert)",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ContactUpsert" } } } },
          responses: {
            "200": { description: "The updated contact.", content: { "application/json": { schema: { $ref: "#/components/schemas/ContactEnvelope" } } } },
            "201": { description: "The created contact.", content: { "application/json": { schema: { $ref: "#/components/schemas/ContactEnvelope" } } } },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/contacts/{id}": {
        get: {
          tags: ["Contacts"],
          summary: "Get a contact by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The contact.", content: { "application/json": { schema: { $ref: "#/components/schemas/ContactEnvelope" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/company-groups": {
        get: {
          tags: ["Companies"],
          summary: "List company groups",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
          ],
          responses: {
            "200": { description: "A page of company groups.", content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyGroupList" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Companies"],
          summary: "Create or update a company group (sparse upsert)",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyGroupUpsert" } } } },
          responses: {
            "200": { description: "The updated company group.", content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyGroupEnvelope" } } } },
            "201": { description: "The created company group.", content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyGroupEnvelope" } } } },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/company-groups/{id}": {
        get: {
          tags: ["Companies"],
          summary: "Get a company group by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The company group.", content: { "application/json": { schema: { $ref: "#/components/schemas/CompanyGroupEnvelope" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/locations": {
        get: {
          tags: ["Reference"],
          summary: "List locations (warehouses / rooms)",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
          ],
          responses: {
            "200": { description: "A page of locations.", content: { "application/json": { schema: { $ref: "#/components/schemas/NamedRefList" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/locations/{id}": {
        get: {
          tags: ["Reference"],
          summary: "Get a location by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The location.", content: { "application/json": { schema: { $ref: "#/components/schemas/NamedRefEnvelope" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/public/v1/unit-types": {
        get: {
          tags: ["Reference"],
          summary: "List unit types (Gram, Ounce, Unit, ...)",
          parameters: [
            { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
            { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
          ],
          responses: {
            "200": { description: "A page of unit types.", content: { "application/json": { schema: { $ref: "#/components/schemas/NamedRefList" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/public/v1/unit-types/{id}": {
        get: {
          tags: ["Reference"],
          summary: "Get a unit type by id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The unit type.", content: { "application/json": { schema: { $ref: "#/components/schemas/NamedRefEnvelope" } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "An API token minted under Settings, API tokens (`dk_live_...`).",
        },
      },
      responses: {
        Unauthorized: {
          description: "Missing or invalid API token.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        BadRequest: {
          description: "Validation error.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        NotFound: {
          description: "Resource not found.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        Forbidden: {
          description: "The token is valid but lacks the required scope.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
      schemas: {
        Ref: ref,
        Product: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            sku: { type: "string" },
            upc: { type: ["string", "null"] },
            inventory_tracking_method: { type: "string", enum: ["PACKAGE", "PRODUCT", "BATCH"] },
            unit_price: { type: ["string", "null"], description: "Decimal string, e.g. \"25.000000\"." },
            msrp: { type: ["string", "null"] },
            category: ref,
            subcategory: ref,
            vendor: ref,
            brand: ref,
            strain: ref,
            product_group: ref,
            unit_type: ref,
            unit_net_weight: { type: ["string", "null"] },
            unit_serving_size: { type: ["string", "null"] },
            serving_unit_type: ref,
            total_thc: { type: ["string", "null"] },
            total_cbd: { type: ["string", "null"] },
            is_inventory_item: { type: "boolean" },
            is_sample: { type: "boolean" },
            taxable: { type: "boolean" },
            description: { type: ["string", "null"] },
            images: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", format: "uuid" },
                  url: { type: "string", description: "Image URL (a data: URL in this clone)." },
                  position: { type: "integer" },
                  is_primary: { type: "boolean" },
                },
              },
            },
            custom_data: { $ref: "#/components/schemas/CustomData" },
            is_active: { type: "boolean" },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        ProductUpsert: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", description: "Include to update; omit to create." },
            name: { type: "string" },
            sku: { type: "string" },
            upc: { type: "string" },
            inventory_tracking_method: { type: "string", enum: ["PACKAGE", "PRODUCT", "BATCH"] },
            category: { type: "string", description: "Category name (created if new)." },
            category_id: { type: "string", format: "uuid" },
            subcategory_id: { type: "string", format: "uuid" },
            vendor: { type: "string", description: "Vendor name (created if new)." },
            vendor_id: { type: "string", format: "uuid" },
            brand: { type: "string", description: "Brand name (created if new)." },
            brand_id: { type: "string", format: "uuid" },
            strain_id: { type: "string", format: "uuid" },
            product_group_id: { type: "string", format: "uuid" },
            unit_type: { type: "string", description: "e.g. Gram, Ounce, Unit." },
            unit_type_id: { type: "string", format: "uuid" },
            unit_price: { type: "number" },
            msrp: { type: "number" },
            unit_net_weight: { type: "number" },
            unit_serving_size: { type: "number" },
            total_thc: { type: "number" },
            total_cbd: { type: "number" },
            net_quantity_per_unit: { type: "number", description: "Deprecated alias for unit_net_weight; still accepted." },
            serving_size: { type: "number", description: "Deprecated alias for unit_serving_size; still accepted." },
            thc_content: { type: "number", description: "Deprecated alias for total_thc; still accepted." },
            cbd_content: { type: "number", description: "Deprecated alias for total_cbd; still accepted." },
            is_inventory_item: { type: "boolean" },
            is_sample: { type: "boolean" },
            taxable: { type: "boolean" },
            description: { type: "string" },
            is_active: { type: "boolean" },
            status: { type: "string", enum: ["ACTIVE", "ARCHIVED"], description: "Deprecated alias; ACTIVE/ARCHIVED maps to is_active. Still accepted." },
          },
        },
        Company: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            relationship_type: ref,
            group: ref,
            tags: { type: "array", items: { type: "string" } },
            custom_data: { $ref: "#/components/schemas/CustomData" },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        CompanyUpsert: {
          type: "object",
          description: "Sparse upsert: omit id to create, include id to update.",
          properties: {
            id: { type: "string", format: "uuid", description: "Include to update an existing company." },
            name: { type: "string", description: "Required when creating." },
            relationship_type: { type: "string", description: "Relationship type name or id (customer, vendor, brand, ...)." },
            group: { type: "string", description: "Company group name or id." },
            roles: { type: "array", items: { type: "string", enum: ["VENDOR", "BRAND", "CUSTOMER"] }, description: "Deprecated alias; still accepted." },
            group_id: { type: ["string", "null"], format: "uuid", description: "Deprecated alias for group; still accepted." },
            tags: { type: "array", items: { type: "string" } },
            custom_data: { $ref: "#/components/schemas/CustomData" },
          },
        },
        Category: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            biotrack_type: { type: ["string", "null"] },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        CategoryCreate: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
        },
        CategoryEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Category" } },
        },
        StockAdjustmentCreate: {
          type: "object",
          required: ["quantity_delta"],
          properties: {
            product_id: { type: "string", format: "uuid" },
            sku: { type: "string" },
            location: { type: "string" },
            quantity_delta: { type: "number", description: "Positive to add, negative to remove." },
            reason: { type: "string" },
          },
        },
        StockAdjustment: {
          type: "object",
          properties: {
            product_id: { type: "string", format: "uuid" },
            sku: { type: "string" },
            location: { type: "string" },
            quantity_delta: { type: "string" },
            on_hand: { type: "string" },
          },
        },
        ProductEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Product" } },
        },
        CompanyEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Company" } },
        },
        StockAdjustmentEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/StockAdjustment" } },
        },
        ProductList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
            next_page: { type: ["string", "null"], description: "URL of the next page, or null." },
            total: { type: "integer" },
          },
        },
        CompanyList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Company" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        CategoryList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Category" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        Address: {
          type: ["object", "null"],
          properties: {
            line1: { type: "string" },
            line2: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            postal_code: { type: "string" },
            country: { type: "string" },
          },
        },
        CustomDataItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            value: {},
          },
        },
        CustomData: {
          type: "array",
          description: "Custom fields as { id, name, value } entries.",
          items: { $ref: "#/components/schemas/CustomDataItem" },
        },
        OrderCharge: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            kind: { type: "string", enum: ["FEE", "DISCOUNT", "SHIPPING", "TAX"] },
            amount: { type: ["string", "null"] },
          },
        },
        ChargeCreate: {
          type: "object",
          required: ["name", "amount"],
          properties: {
            name: { type: "string" },
            kind: { type: "string", enum: ["FEE", "DISCOUNT", "SHIPPING", "TAX"], default: "FEE" },
            amount: { type: "number" },
          },
        },
        ProductRef: {
          anyOf: [
            {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                name: { type: "string" },
                sku: { type: ["string", "null"] },
              },
            },
            { type: "null" },
          ],
        },
        OrderItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            product: { $ref: "#/components/schemas/ProductRef" },
            quantity: { type: ["string", "null"] },
            price: { type: ["string", "null"] },
            line_total: { type: ["string", "null"] },
          },
        },
        Order: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            order_number: { type: "string" },
            status: { type: "string", enum: ["PENDING", "PROCESSING", "READY_TO_SHIP", "DELIVERING", "DELIVERED", "COMPLETED", "CANCELED"] },
            company: ref,
            location: ref,
            order_datetime: { type: ["string", "null"] },
            subtotal: { type: ["string", "null"] },
            charge_total: { type: ["string", "null"] },
            discount_total: { type: ["string", "null"] },
            tax_total: { type: ["string", "null"] },
            total: { type: ["string", "null"] },
            internal_notes: { type: ["string", "null"] },
            external_notes: { type: ["string", "null"] },
            billing_location: { $ref: "#/components/schemas/Address" },
            shipping_location: { $ref: "#/components/schemas/Address" },
            tags: { type: "array", items: { type: "string" } },
            custom_data: { $ref: "#/components/schemas/CustomData" },
            items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
            charges: { type: "array", items: { $ref: "#/components/schemas/OrderCharge" } },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        OrderCreate: {
          type: "object",
          required: ["items"],
          properties: {
            customer: { type: "string", description: "Customer name (created if new)." },
            customer_id: { type: "string", format: "uuid" },
            location_id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["PENDING", "PROCESSING", "READY_TO_SHIP", "DELIVERING", "DELIVERED", "COMPLETED"], default: "PROCESSING" },
            notes: { type: "string" },
            billing_address: { $ref: "#/components/schemas/Address" },
            shipping_address: { $ref: "#/components/schemas/Address" },
            tags: { type: "array", items: { type: "string" } },
            custom_data: { $ref: "#/components/schemas/CustomData" },
            charges: { type: "array", items: { $ref: "#/components/schemas/ChargeCreate" } },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["quantity"],
                properties: {
                  product_id: { type: "string", format: "uuid" },
                  sku: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                },
              },
            },
          },
        },
        InvoiceRef: {
          anyOf: [
            {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                invoice_number: { type: "string" },
              },
            },
            { type: "null" },
          ],
        },
        Payment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            invoice: { $ref: "#/components/schemas/InvoiceRef" },
            amount: { type: ["string", "null"] },
            payment_method: { type: ["string", "null"] },
            payment_type: { type: ["string", "null"] },
            status: { type: ["string", "null"] },
            reference: { type: ["string", "null"] },
            payment_datetime: { type: ["string", "null"] },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        PaymentEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Payment" } },
        },
        PaymentList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Payment" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        Contact: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            company: {
              anyOf: [
                { type: "object", properties: { id: { type: "string", format: "uuid" } } },
                { type: "null" },
              ],
            },
            first_name: { type: ["string", "null"] },
            last_name: { type: ["string", "null"] },
            full_name: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            phone_number: { type: ["string", "null"] },
            work_phone_number: { type: ["string", "null"] },
            title: { type: ["string", "null"] },
            custom_data: { $ref: "#/components/schemas/CustomData" },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        ContactUpsert: {
          type: "object",
          description: "Sparse upsert: omit id to create, include id to update.",
          properties: {
            id: { type: "string", format: "uuid" },
            company: { type: "string", description: "Company id the contact belongs to." },
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone_number: { type: "string" },
            work_phone_number: { type: "string" },
            title: { type: "string" },
            company_id: { type: ["string", "null"], format: "uuid", description: "Deprecated alias for company; still accepted." },
            name: { type: "string", description: "Deprecated alias; split into first_name/last_name. Still accepted." },
            phone: { type: "string", description: "Deprecated alias for phone_number; still accepted." },
            custom_data: { $ref: "#/components/schemas/CustomData" },
          },
        },
        ContactEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Contact" } },
        },
        ContactList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Contact" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        CompanyGroup: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        CompanyGroupUpsert: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", description: "Required when creating." },
          },
        },
        CompanyGroupEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/CompanyGroup" } },
        },
        CompanyGroupList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/CompanyGroup" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        NamedRef: {
          type: "object",
          properties: { id: { type: "string", format: "uuid" }, name: { type: "string" } },
        },
        NamedRefEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/NamedRef" } },
        },
        NamedRefList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/NamedRef" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        OrderRef: {
          anyOf: [
            {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                order_number: { type: "string" },
              },
            },
            { type: "null" },
          ],
        },
        InvoicePayment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            amount: { type: ["string", "null"] },
            payment_method: { type: ["string", "null"] },
            reference: { type: ["string", "null"] },
            payment_datetime: { type: ["string", "null"] },
          },
        },
        Invoice: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            invoice_number: { type: "string" },
            status: { type: "string", enum: ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID", "OVER_PAID"] },
            payment_status: { type: "string", enum: ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID", "OVER_PAID"] },
            voided_datetime: { type: ["string", "null"], description: "When the invoice was voided, or null." },
            order: { $ref: "#/components/schemas/OrderRef" },
            company: ref,
            invoice_datetime: { type: ["string", "null"] },
            due_datetime: { type: ["string", "null"] },
            subtotal: { type: ["string", "null"] },
            charge_total: { type: ["string", "null"] },
            discount_total: { type: ["string", "null"] },
            tax_total: { type: ["string", "null"] },
            total: { type: ["string", "null"] },
            paid_amount: { type: ["string", "null"] },
            credits_applied: { type: ["string", "null"] },
            remaining_amount: { type: ["string", "null"] },
            internal_notes: { type: ["string", "null"] },
            external_notes: { type: ["string", "null"] },
            billing_location: { $ref: "#/components/schemas/Address" },
            tags: { type: "array", items: { type: "string" } },
            custom_data: { $ref: "#/components/schemas/CustomData" },
            items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
            charges: { type: "array", items: { $ref: "#/components/schemas/OrderCharge" } },
            payments: { type: "array", items: { $ref: "#/components/schemas/InvoicePayment" } },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        InvoiceCreate: {
          type: "object",
          properties: {
            order_id: { type: "string", format: "uuid" },
            order_number: { type: "string" },
            due_date: { type: "string", description: "ISO date, e.g. 2026-10-01." },
            payment: {
              type: "object",
              required: ["amount"],
              properties: { amount: { type: "number" }, method: { type: "string" } },
            },
          },
        },
        OrderEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Order" } },
        },
        InvoiceEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Invoice" } },
        },
        OrderList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Order" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        InvoiceList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Invoice" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        PurchaseOrderItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            product_id: { type: ["string", "null"], format: "uuid" },
            sku: { type: ["string", "null"] },
            name: { type: "string" },
            quantity: { type: ["string", "null"] },
            unit_cost: { type: ["string", "null"] },
            line_total: { type: ["string", "null"] },
          },
        },
        PurchaseOrder: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            po_number: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "OPEN", "RECEIVED", "CANCELED"] },
            vendor: ref,
            location: ref,
            order_datetime: { type: ["string", "null"] },
            total: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            items: { type: "array", items: { $ref: "#/components/schemas/PurchaseOrderItem" } },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        PurchaseOrderCreate: {
          type: "object",
          required: ["items"],
          properties: {
            vendor: { type: "string", description: "Vendor name (created if new)." },
            vendor_id: { type: "string", format: "uuid" },
            location_id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["DRAFT", "OPEN", "RECEIVED"], default: "OPEN" },
            notes: { type: "string" },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["quantity"],
                properties: {
                  product_id: { type: "string", format: "uuid" },
                  sku: { type: "string" },
                  quantity: { type: "number" },
                  unit_cost: { type: "number" },
                },
              },
            },
          },
        },
        PurchaseOrderEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/PurchaseOrder" } },
        },
        PurchaseOrderList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/PurchaseOrder" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        ReturnItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            product_id: { type: ["string", "null"], format: "uuid" },
            sku: { type: ["string", "null"] },
            name: { type: "string" },
            quantity: { type: ["string", "null"] },
            unit_price: { type: ["string", "null"] },
            line_total: { type: ["string", "null"] },
          },
        },
        Return: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            return_number: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "RECEIVED", "CANCELED"] },
            order_id: { type: ["string", "null"], format: "uuid" },
            customer: ref,
            location: ref,
            reason: { type: ["string", "null"] },
            return_datetime: { type: ["string", "null"] },
            total: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            items: { type: "array", items: { $ref: "#/components/schemas/ReturnItem" } },
            inserted_datetime: { type: "string" },
            updated_datetime: { type: "string" },
          },
        },
        ReturnCreate: {
          type: "object",
          required: ["items"],
          properties: {
            customer: { type: "string", description: "Customer name (created if new)." },
            customer_id: { type: "string", format: "uuid" },
            order_number: { type: "string", description: "Original order this return reverses." },
            location_id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["DRAFT", "RECEIVED"], default: "RECEIVED" },
            reason: { type: "string" },
            notes: { type: "string" },
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["quantity"],
                properties: {
                  product_id: { type: "string", format: "uuid" },
                  sku: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                },
              },
            },
          },
        },
        ReturnEnvelope: {
          type: "object",
          properties: { data: { $ref: "#/components/schemas/Return" } },
        },
        ReturnList: {
          type: "object",
          properties: {
            data: { type: "array", items: { $ref: "#/components/schemas/Return" } },
            next_page: { type: ["string", "null"] },
            total: { type: "integer" },
          },
        },
        Error: {
          type: "object",
          properties: {
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  message: { type: "string", description: "Human-readable description; may change, so branch on pointer, not text." },
                  pointer: {
                    type: "array",
                    items: { type: ["string", "integer"] },
                    description: "Path to the offending value: object keys as strings, array indices as integers, e.g. [\"items\", 0, \"sku\"].",
                  },
                  section: {
                    type: "string",
                    enum: ["body", "query", "path", "header"],
                    description: "Which part of the request the pointer is rooted in.",
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  // The scaffold-tier resources (manufacturing, compliance, logistics, catalog
  // depth, inventory lots, sales config, platform cross-cutting) all follow the
  // same list / get / sparse-upsert shape, so their paths + schemas are generated
  // from compact descriptors rather than hand-written. This keeps the whole live
  // surface documented without ~130 repetitive blocks.
  const scaffold = buildScaffoldResources();
  const paths = spec.paths as Record<string, unknown>;
  for (const [k, v] of Object.entries(scaffold.paths)) paths[k] = v;
  const schemas = (spec.components as { schemas: Record<string, unknown> }).schemas;
  for (const [k, v] of Object.entries(scaffold.schemas)) schemas[k] = v;

  // Fuller-parity surface (reports, Metrc, PDF, nested actions, misc), each
  // contributed by a fragment file under lib/openapi-fragments/ (see openapi-extra).
  for (const [k, v] of Object.entries(EXTRA_PATHS)) paths[k] = v;
  for (const [k, v] of Object.entries(EXTRA_SCHEMAS)) schemas[k] = v;

  // Every scoped operation can return 403 (valid token, missing scope). Rather
  // than repeat it on each operation, add it wherever a 401 is already declared.
  const forbidden = { $ref: "#/components/responses/Forbidden" };
  for (const path of Object.values(spec.paths as Record<string, Record<string, { responses?: Record<string, unknown> }>>)) {
    for (const op of Object.values(path)) {
      if (op?.responses && "401" in op.responses && !("403" in op.responses)) {
        op.responses["403"] = forbidden;
      }
    }
  }

  return spec;
}

// ---------------- Scaffold-resource OpenAPI generator ----------------

type Sch = Record<string, unknown>;
type Field = { key: string; schema: Sch; write?: boolean };
type Resource = {
  tag: string;
  path: string; // e.g. "strains"
  title: string; // schema base name, e.g. "Strain"
  fields: Field[]; // response fields (excluding id + timestamps)
  extra?: Sch; // extra response-only properties (e.g. nested collections)
  post?: boolean; // default true
  getId?: boolean; // default true
  updated?: boolean; // include updated_datetime (default true)
  requiredNote?: string; // field required when creating
};

// Field-schema shorthands (numbers are strings; nullable where optional).
const _s: Sch = { type: ["string", "null"] };
const _req: Sch = { type: "string" };
const _uuid: Sch = { type: ["string", "null"], format: "uuid" };
const _num: Sch = { type: ["string", "null"] };
const _obj: Sch = { type: "object", additionalProperties: true };
const _enum = (v: string[]): Sch => ({ type: "string", enum: v });
const _customData: Sch = { $ref: "#/components/schemas/CustomData" };
const _lineArray = (props: Sch): Sch => ({ type: "array", items: { type: "object", properties: props } });

const CATALOG: Resource[] = [
  { tag: "Catalog", path: "strains", title: "Strain", fields: [{ key: "name", schema: _req }, { key: "type", schema: _s }] },
  { tag: "Catalog", path: "product-subcategories", title: "ProductSubcategory", fields: [{ key: "name", schema: _req }, { key: "category_id", schema: _uuid }] },
  { tag: "Catalog", path: "product-groups", title: "ProductGroup", fields: [{ key: "name", schema: _req }] },
  { tag: "Catalog", path: "tags", title: "Tag", fields: [{ key: "name", schema: _req }] },
  { tag: "Catalog", path: "taxes", title: "Tax", fields: [{ key: "name", schema: _req }, { key: "rate", schema: _num }] },
  { tag: "Catalog", path: "official-product-categories", title: "OfficialProductCategory", fields: [{ key: "name", schema: _req }], post: false, getId: false, updated: false },
];

const INVENTORY_DEPTH: Resource[] = [
  { tag: "Inventory", path: "bins", title: "Bin", fields: [{ key: "name", schema: _req }, { key: "location_id", schema: _uuid }] },
  { tag: "Inventory", path: "packages", title: "Package", fields: [{ key: "package_tag", schema: _req }, { key: "product_id", schema: _uuid }, { key: "location_id", schema: _uuid }, { key: "quantity", schema: _num }, { key: "status", schema: _req }], requiredNote: "package_tag" },
  { tag: "Inventory", path: "batches", title: "Batch", fields: [{ key: "batch_number", schema: _req }, { key: "product_id", schema: _uuid }], requiredNote: "batch_number" },
];

const SALES_CONFIG: Resource[] = [
  { tag: "Sales config", path: "payment-methods", title: "PaymentMethod", fields: [{ key: "name", schema: _req }] },
  { tag: "Sales config", path: "payment-terms", title: "PaymentTerm", fields: [{ key: "name", schema: _req }, { key: "net_days", schema: _num }] },
  { tag: "Sales config", path: "price-tiers", title: "PriceTier", fields: [{ key: "name", schema: _req }] },
  { tag: "Sales config", path: "charge-presets", title: "ChargePreset", fields: [{ key: "name", schema: _req }, { key: "kind", schema: _enum(["FEE", "DISCOUNT", "SHIPPING", "TAX"]) }, { key: "amount", schema: _num }] },
  { tag: "Sales config", path: "menus", title: "Menu", fields: [{ key: "name", schema: _req }, { key: "price_tier_id", schema: _uuid }, { key: "published", schema: _req }] },
  { tag: "Sales config", path: "credits", title: "Credit", fields: [{ key: "customer_id", schema: _uuid }, { key: "amount", schema: _num }, { key: "remaining", schema: _num }, { key: "reason", schema: _s }], requiredNote: "amount" },
];

const MANUFACTURING: Resource[] = [
  {
    tag: "Manufacturing", path: "assemblies", title: "Assembly",
    fields: [
      { key: "assembly_number", schema: _s },
      { key: "status", schema: _enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELED"]) },
      { key: "location_id", schema: _uuid },
      { key: "completion_datetime", schema: _s },
      { key: "notes", schema: _s },
      { key: "custom_data", schema: _customData },
    ],
    extra: {
      inputs: _lineArray({ id: { type: "string", format: "uuid" }, product_id: _uuid, quantity: _num }),
      outputs: _lineArray({ id: { type: "string", format: "uuid" }, product_id: _uuid, quantity: _num }),
      costs: _lineArray({ id: { type: "string", format: "uuid" }, cost_type_id: _uuid, description: _s, amount: _num }),
    },
  },
  { tag: "Manufacturing", path: "cost-types", title: "CostType", fields: [{ key: "name", schema: _req }] },
  { tag: "Manufacturing", path: "costs", title: "Cost", fields: [{ key: "assembly_id", schema: _uuid }, { key: "cost_type_id", schema: _uuid }, { key: "description", schema: _s }, { key: "amount", schema: _num }], getId: false, updated: false, requiredNote: "amount" },
];

const COMPLIANCE: Resource[] = [
  { tag: "Compliance", path: "licenses", title: "License", fields: [{ key: "license_number", schema: _req }, { key: "license_type_id", schema: _uuid }, { key: "name", schema: _s }, { key: "state", schema: _s }, { key: "expires_datetime", schema: _s }], requiredNote: "license_number" },
  { tag: "Compliance", path: "license-types", title: "LicenseType", fields: [{ key: "name", schema: _req }], getId: false },
  { tag: "Compliance", path: "test-results", title: "TestResult", fields: [{ key: "product_id", schema: _uuid }, { key: "metrc_lab_test_id", schema: _s }, { key: "tested_datetime", schema: _s }, { key: "passed", schema: _s }, { key: "results", schema: _obj }] },
];

const LOGISTICS: Resource[] = [
  { tag: "Logistics", path: "drivers", title: "Driver", fields: [{ key: "name", schema: _req }, { key: "phone", schema: _s }, { key: "license_number", schema: _s }] },
  { tag: "Logistics", path: "vehicles", title: "Vehicle", fields: [{ key: "name", schema: _req }, { key: "make", schema: _s }, { key: "model", schema: _s }, { key: "license_plate", schema: _s }] },
];

const PLATFORM_DEPTH: Resource[] = [
  { tag: "Platform", path: "custom-fields", title: "CustomField", fields: [{ key: "entity_type", schema: _req }, { key: "name", schema: _req }, { key: "field_type", schema: _req }] },
  { tag: "Platform", path: "file-attachments", title: "FileAttachment", fields: [{ key: "entity_type", schema: _req }, { key: "entity_id", schema: _uuid }, { key: "filename", schema: _req }, { key: "url", schema: _s }, { key: "content_type", schema: _s }], requiredNote: "filename" },
  { tag: "Platform", path: "tasks", title: "Task", fields: [{ key: "title", schema: _req }, { key: "status", schema: _req }, { key: "assignee_id", schema: _uuid }, { key: "due_datetime", schema: _s }, { key: "entity_type", schema: _s }, { key: "entity_id", schema: _uuid }] },
];

const SCAFFOLD_RESOURCES: Resource[] = [
  ...CATALOG, ...INVENTORY_DEPTH, ...SALES_CONFIG, ...MANUFACTURING, ...COMPLIANCE, ...LOGISTICS, ...PLATFORM_DEPTH,
];

function buildScaffoldResources(): { paths: Record<string, Sch>; schemas: Record<string, Sch> } {
  const paths: Record<string, Sch> = {};
  const schemas: Record<string, Sch> = {};
  const pageParams = [
    { name: "page[number]", in: "query", schema: { type: "integer", minimum: 1, default: 1 }, description: "1-based page number - the primary pagination scheme; follow the response's next_page URL for the following page. Defaults to 1." },
    { name: "page[after]", in: "query", schema: { type: "string" }, description: "Also accepted: an opaque cursor from a prior response's next_page." },
  ];

  for (const r of SCAFFOLD_RESOURCES) {
    const withId = r.getId !== false;
    const withPost = r.post !== false;
    const withUpdated = r.updated !== false;

    // Response schema.
    const props: Sch = { id: { type: "string", format: "uuid" } };
    for (const f of r.fields) props[f.key] = f.schema;
    if (r.extra) Object.assign(props, r.extra);
    props.inserted_datetime = { type: "string" };
    if (withUpdated) props.updated_datetime = { type: "string" };
    schemas[r.title] = { type: "object", properties: props };
    schemas[`${r.title}Envelope`] = { type: "object", properties: { data: { $ref: `#/components/schemas/${r.title}` } } };
    schemas[`${r.title}List`] = {
      type: "object",
      properties: {
        data: { type: "array", items: { $ref: `#/components/schemas/${r.title}` } },
        next_page: { type: ["string", "null"] },
        total: { type: "integer" },
      },
    };
    if (withPost) {
      const upsertProps: Sch = { id: { type: "string", format: "uuid", description: "Include to update; omit to create." } };
      for (const f of r.fields) if (f.write !== false) upsertProps[f.key] = f.schema;
      if (r.extra) Object.assign(upsertProps, r.extra);
      schemas[`${r.title}Upsert`] = {
        type: "object",
        description: `Sparse upsert${r.requiredNote ? ` (\`${r.requiredNote}\` required on create)` : ""}: omit id to create, include id to update.`,
        properties: upsertProps,
      };
    }

    // Paths.
    const listOp: Sch = {
      tags: [r.tag],
      summary: `List ${r.path.replace(/-/g, " ")}`,
      parameters: pageParams,
      responses: {
        "200": { description: "A page.", content: { "application/json": { schema: { $ref: `#/components/schemas/${r.title}List` } } } },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    };
    const collection: Sch = { get: listOp };
    if (withPost) {
      collection.post = {
        tags: [r.tag],
        summary: `Create or update a ${r.title} (sparse upsert)`,
        requestBody: { required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${r.title}Upsert` } } } },
        responses: {
          "200": { description: "The updated record.", content: { "application/json": { schema: { $ref: `#/components/schemas/${r.title}Envelope` } } } },
          "201": { description: "The created record.", content: { "application/json": { schema: { $ref: `#/components/schemas/${r.title}Envelope` } } } },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      };
    }
    paths[`/public/v1/${r.path}`] = collection;

    if (withId) {
      paths[`/public/v1/${r.path}/{id}`] = {
        get: {
          tags: [r.tag],
          summary: `Get a ${r.title} by id`,
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The record.", content: { "application/json": { schema: { $ref: `#/components/schemas/${r.title}Envelope` } } } },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      };
    }
  }

  return { paths, schemas };
}

/**
 * Serialize a plain JSON value to YAML. Every scalar string is double-quoted with
 * minimal escaping, which is always valid YAML - so this stays correct without a
 * dependency, for the plain (acyclic, JSON-shaped) spec object above.
 */
export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return quote(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        const rendered = toYaml(item, indent + 1);
        if (isScalar(item)) return `${pad}- ${rendered}`;
        // Nested object/array: first line after "- ", rest already indented.
        return `${pad}- ${rendered.replace(/^\s+/, "")}`;
      })
      .join("\n");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([k, v]) => {
      const key = quote(k);
      if (isScalar(v)) return `${pad}${key}: ${toYaml(v, indent)}`;
      if (Array.isArray(v) && v.length === 0) return `${pad}${key}: []`;
      if (!Array.isArray(v) && Object.keys(v as Record<string, unknown>).length === 0)
        return `${pad}${key}: {}`;
      return `${pad}${key}:\n${toYaml(v, indent + 1)}`;
    })
    .join("\n");
}

function isScalar(v: unknown): boolean {
  return v === null || v === undefined || typeof v !== "object";
}

function quote(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}
