---
title: "API reference (explorer & OpenAPI)"
section: "Developers"
summary: "Browse and call the public API from the interactive explorer, or load the machine-readable OpenAPI spec."
keywords: ["openapi","swagger","scalar","spec","api reference","explorer","try it","yaml","json","redoc","postman","schema","endpoints","codegen"]
order: 10
---
# API reference

## Interactive explorer
Distru ships an interactive **API Reference** explorer at **[/api-reference](/api-reference)** (also under Settings). It's a full OpenAPI console, driven by the app's own live spec:

- **Browse** every endpoint, grouped by resource, with request and response schemas.
- **Try it** - send real requests to the live API right from the browser, with your token, and see the actual responses.
- Read the getting-started notes on auth and conventions, toggle dark mode, and download the spec.

Because it reads the same spec the API is built from, what you see is always in step with the running API.

## The OpenAPI spec
The public API ships a machine-readable **OpenAPI 3.1** description, served live at:

- **[/api/openapi.yaml](/api/openapi.yaml)** - YAML
- **[/api/openapi.json](/api/openapi.json)** - JSON

Load either into **Swagger UI, Redoc, Postman, or Insomnia**, or feed it to a codegen tool to generate a typed client. The spec documents the auth scheme, every endpoint, request and response schemas, and Distru's conventions (numbers as strings, `page[number]` pagination with a `next_page` URL - `page[after]` also accepted as an opaque cursor, sparse upsert, and the `{ errors: [...] }` envelope).

## Endpoints at a glance
The API uses two verbs - `GET` to read and `POST` to write - with updates done by sparse upsert (include an `id` to update, omit it to create). A representative slice of the surface:

| Method | Path | Purpose |
|---|---|---|
| GET | `/public/v1/products` | List products (filters: `page[number]`, `status`, `category`, `vendor`, `search`) |
| POST | `/public/v1/products` | Create or update a product (sparse upsert) |
| GET | `/public/v1/products/{id}` | Get one product |
| GET/POST | `/public/v1/companies` | List / create companies (customers, vendors, brands) |
| GET | `/public/v1/product-categories` | List categories |
| POST | `/public/v1/adjustments` | Post a stock adjustment |
| GET/POST | `/public/v1/orders`, GET `/public/v1/orders/{id}` | Sales orders (+ `/pdf`) |
| GET/POST | `/public/v1/invoices`, GET `/public/v1/invoices/{id}` | Invoices (+ `/payments`, `/pdf`) |
| GET/POST | `/public/v1/purchases`, GET `/public/v1/purchases/{id}` | Purchase orders (receiving adds inventory) |
| GET/POST | `/public/v1/returns`, GET `/public/v1/returns/{id}` | Customer returns (receiving restocks inventory) |
| GET/POST | `/public/v1/packages`, `/public/v1/batches`, `/public/v1/bins` | Inventory lot units |
| GET/POST | `/public/v1/transfers` | Stock transfers (+ `/manifest/pdf`) |
| GET/POST | `/public/v1/assemblies` | Manufacturing assemblies |
| GET/POST | `/public/v1/plants`, `/public/v1/plant-batches`, `/public/v1/harvests` | Cultivation |
| GET/POST | `/public/v1/test-results`, `/public/v1/licenses` | Compliance (+ COA `/pdf`) |
| GET/POST | `/public/v1/deliveries`, `/public/v1/drivers`, `/public/v1/vehicles` | Logistics |
| GET/POST | `/public/v1/tasks` | Tasks |
| GET | `/public/v1/reports/{name}` | The report registry (about two dozen reports) |
| GET | `/public/v1/metrc/...` | Read-only Metrc mirror (packages, transfers, tags, ...) |
| GET | `/public/v1/locations`, `/public/v1/unit-types` | Reference data |

Orders and invoices carry a full money breakdown (`subtotal` / `charge_total` / `discount_total` / `tax_total` / `total`) with a `charges` collection (FEE/DISCOUNT/SHIPPING/TAX); `custom_data` and `tags` are accepted across products, companies, orders, invoices, and contacts.

## Agent resources
Agents get first-class resources mirroring the real Distru API: a compact endpoint index at [/llms.txt](/llms.txt), the full docs inlined at [/llms-full.txt](/llms-full.txt), and an Agent Skill of the API conventions at [/skill.md](/skill.md).

Every request needs a Bearer token - mint one under **Settings, API tokens**. For auth, the MCP server, and webhooks see [API, MCP, and webhooks](/docs/api-and-integrations); for the bulk uploader see [Importing data](/docs/importing).
