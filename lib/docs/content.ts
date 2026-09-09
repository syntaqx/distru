/**
 * Product documentation. One source of truth for both the in-product Docs pages
 * and the Copilot's docs tools (search_docs / read_doc), so the assistant answers
 * "how do I ..." questions from the same articles a human reads. Written as real
 * product docs for what Distru actually supports - array order is reading order.
 */
export type DocArticle = {
  slug: string;
  section: string;
  title: string;
  summary: string;
  keywords: string[];
  body: string;
};

export const DOCS: DocArticle[] = [
  {
    slug: "overview",
    section: "Getting started",
    title: "What is Distru",
    summary: "The platform, your workspace, and how to find your way around.",
    keywords: ["overview", "workspace", "tenant", "getting started", "sign in", "copilot", "navigation"],
    body: `# What is Distru

Distru is a seed-to-sale ERP for licensed cannabis operators. It keeps your **catalog**, **inventory**, and **companies** (your CRM) in one place, with an AI **Copilot** built in that can do the same work through conversation.

## Your workspace
Everything you see belongs to a **workspace** - an isolated organization with its own data, members, and API tokens. The switcher in the top-left shows which workspace you're in; switching it changes every page and the Copilot's context.

## Finding your way
- **Inventory** - your product catalog and on-hand stock.
- **Categories** - organize the catalog; also created on the fly when you name one on a product.
- **Companies** - customers, vendors, distributors, and brands.
- **Sales** - orders, invoices, and payments; confirming an order moves inventory.
- **Automations** - saved tasks the Copilot runs unattended, with run history.
- **Integrations** - connect the tools you use; mint API tokens and manage webhooks under Settings.
- **Copilot** - the assistant, opened from the top-right or with Ctrl/Cmd+J. It reads and changes the same records the pages do, asks before it changes anything, and can make bulk changes in one approval.

Modules for purchasing, manufacturing, compliance, and cultivation appear in the navigation and are on the roadmap.`,
  },
  {
    slug: "products",
    section: "Catalog",
    title: "Products and categories",
    summary: "How the catalog works: products, SKUs, categories, and product fields.",
    keywords: ["product", "products", "catalog", "create product", "add product", "edit", "archive", "sku", "unit price", "tracking method", "category", "categories"],
    body: `# Products and categories

A **product** is a single catalog item, identified by a **SKU that is unique within your workspace**. You manage products on the **Inventory** page.

## Create a product
Click **New product** and fill in the fields. **Name** and **SKU** are required; everything else is optional and can be added later.

## Product fields
- **SKU** - your unique identifier for the item. Re-importing a file matches on SKU, so keep them stable.
- **Inventory tracking method** - \`PACKAGE\`, \`PRODUCT\`, or \`BATCH\`, depending on how you track the item.
- **Unit type** - the unit the product is measured in (Gram, Ounce, Unit, Milliliter, and so on). This is a fixed list; an unrecognized unit is rejected.
- **Unit price** and **MSRP** - stored with full precision.
- **UPC / barcode** - optional retail identifier.
- **THC %** and **CBD %** - optional potency, for compliance and merchandising.
- **Category**, **Vendor**, and **Brand** - optional classifications, created on demand (see below). Vendor and Brand are both **Companies**.
- **Images** - one or more product photos. Upload them on the product page, or provide image URLs in an import and they are downloaded and attached automatically.

## Categories
Categories organize your catalog. There is no separate list to set up first: type a category name on the product form and it is created automatically the first time you use it. To manage them directly - rename, delete, set a BioTrack type, or see how many products each holds - use the **Categories** page in the sidebar (deleting a category leaves its products in place, just uncategorized).

## Edit or archive
Use the pencil on a row to edit a product, or the archive icon to archive it. Archiving is a soft delete - the product is hidden but its history is kept, and you can restore it.

> The Copilot can do all of this for you: *"Add a product: Blue Dream 3.5g, SKU FL-BD-35, category Flower, vendor Sungrown Farms, unit gram, $25."* It shows the change for approval, then it appears here.`,
  },
  {
    slug: "inventory",
    section: "Catalog",
    title: "Inventory and on-hand",
    summary: "How on-hand stock is tracked and adjusted, and why it's auditable.",
    keywords: ["inventory", "on hand", "on-hand", "stock", "adjust", "set stock", "ledger", "location", "audit", "packages", "batches", "bins"],
    body: `# Inventory and on-hand

On-hand stock is tracked as an **append-only ledger** of movements. A product's on-hand at a location is the sum of its movements, so every change is traceable and nothing is silently overwritten.

## Set or adjust stock
Edit a product and set the **On hand** field. Distru posts the difference between the old and new value as a single adjustment - you set the target you want, and the ledger records the delta.

## Attribution
Every movement records who made it - a person, the public API, an import, or an automation - in the **audit log**, alongside the reason. This is what makes on-hand trustworthy across all the ways data can change.

## Beyond raw on-hand
Distru also tracks Metrc-style lot units - **packages, batches, and bins** - beneath a product's on-hand, on the Inventory sub-nav. See [Packages, batches & bins](/docs/packages).

> Ask the Copilot *"set Blue Dream 3.5g on-hand to 200"* or *"add 25 to OG Kush"* and approve the card to post the same adjustment.`,
  },
  {
    slug: "companies",
    section: "Catalog",
    title: "Companies (CRM)",
    summary: "Customers, vendors, distributors, and brands, and the roles that classify them.",
    keywords: ["company", "companies", "crm", "customer", "vendor", "distributor", "brand", "supplier", "roles", "create company", "delete company"],
    body: `# Companies

The **Companies** page is your CRM. It holds every business you work with - customers, vendors, distributors, and brands - and a single company can hold more than one role at once.

## Roles
- **Customer** - a business you sell to.
- **Vendor** - a business you buy from (a distributor is a vendor).
- **Brand** - the brand a product belongs to.

## Manage companies
Click **New company**, give it a name, and pick one or more roles. Use the pencil to edit a company's name or roles, and the trash icon to delete it. Deleting a company does not delete products that referenced it as a vendor - those products simply lose the link.

## Where companies come from
Companies are created here by hand, automatically when you name a new Vendor/Brand on a product, or in bulk by importing a customer or vendor list - see **Importing data**.`,
  },
  {
    slug: "sales",
    section: "Selling",
    title: "Sales orders and invoicing",
    summary: "Sell to customers, decrement inventory, invoice orders, and record payments.",
    keywords: ["sales", "order", "orders", "sales order", "invoice", "invoicing", "payment", "customer", "fulfill", "confirm", "cancel", "revenue", "billing", "return", "credit"],
    body: `# Sales orders and invoicing

The **Sales** page is where the catalog turns into revenue. An **order** is a set of line items sold to a customer; an **invoice** is a billable snapshot of an order; and **payments** settle invoices.

## Orders
Click **New order**, pick a customer (created with the CUSTOMER role if new), and add line items - each is a product matched by SKU, a quantity, and a unit price that defaults to the product's price.

An order moves through Distru's fulfillment lifecycle:
- **Pending** - saved but holds no stock. Use it to stage an order you're not ready to fulfill.
- **Processing** → **Ready to ship** → **Delivering** → **Delivered** → **Completed** - the active fulfillment stages. On-hand is **decremented** for every line the moment an order leaves Pending (posted to the inventory ledger as a \`sale\` movement, fully auditable), and stays committed through completion.
- **Canceled** - the order is voided and any stock it took is **restored**.

Leaving Pending is the only step that moves inventory, and it does so exactly once - canceling reverses it.

## Invoices and payments
From an active (non-pending) order, create an **invoice**: it snapshots the order's full financial breakdown (subtotal, charges, discounts, taxes, total) at issue time. Its **payment status** rolls **Not paid** → **Partially paid** → **Fully paid** (and **Over paid** if you record more than the balance) as you record payments; an invoice can also be **voided** independently. The balance due is total minus payments and any credits applied.

To reverse a sale, record a **return** (which restocks inventory), issue a **credit**, or see every payment in one list - all under the Sales sub-nav; see [Returns, credits & payments](/docs/returns).

## The Copilot does all of this
Everything on this page is also an agent action, each behind a single approval:

> *"Sell 10 Blue Dream 3.5g and 5 OG Kush 3.5g to Green Leaf Dispensary."*
> *"Invoice order SO-0007, net 30."*
> *"Record a $250 check payment on INV-0003."*
> *"Cancel order SO-0005."*

You can also **import** historical orders from a spreadsheet - each row is a line item grouped by order number; imported orders land as **drafts** for you to review before they touch inventory (see **Importing data**).`,
  },
  {
    slug: "importing",
    section: "Importing data",
    title: "Import a CSV or XLSX",
    summary: "Drop in any spreadsheet; the Copilot detects, maps, validates, and imports it.",
    keywords: ["import", "csv", "xlsx", "upload", "catalog", "mapping", "detection", "error csv", "price sheet", "customers", "vendors", "inventory count", "upsert"],
    body: `# Importing data

Drop a CSV or XLSX of **any column layout** onto the Copilot (drag it in, or use the paperclip). You don't have to say what it is or format it a particular way first.

## What happens
1. **Detect** - the Copilot figures out what the file is: a product catalog, price sheet, customer list, vendor/distributor list, inventory count, sales orders, or locations list. If it's ambiguous it asks which; if nothing fits, it tells you and imports nothing rather than guessing.
2. **Map** - it proposes which spreadsheet columns feed which Distru fields (for example \`Item #\` becomes SKU), and you can correct any mapping.
3. **Validate** - every row is checked. You get counts of valid, warning, and error rows plus the top reasons, without dumping the raw file.
4. **Commit** - after you approve, valid rows are imported. Imports **upsert by SKU**, so re-uploading an updated file changes the matching records instead of creating duplicates. Error rows are skipped.
5. **Error report** - failed rows come back as a downloadable CSV containing your original columns plus the specific error, so you can fix them and re-upload.

## Supported import types
Products, customers, vendors/distributors, price lists (update prices by SKU), inventory counts (set on-hand by SKU), sales orders (line items grouped into draft orders), and locations. Large files - 10,000+ rows - are processed in chunks. New types are added as a single adapter file, so this list grows without touching the import flow (developers: see [The import pipeline](/docs/import-pipeline)).

## Product imports go deep
A product file maps far more than name and SKU. Columns for **UPC**, **MSRP**, **THC %**, **CBD %**, **brand**, **vendor**, **category**, **unit type**, **tracking method**, and a **quantity on-hand** are all recognized - and every field understands the many ways customers name it (\`qty\`, \`quantity\`, \`on hand\`, \`stock\`, \`units\`... all map to the same on-hand field). If a column has an **image URL**, the image is downloaded and attached to the product; multiple URLs (comma, pipe, or space separated) attach multiple images. A quantity column sets on-hand at your default location.`,
  },
  {
    slug: "copilot",
    section: "Copilot",
    title: "Using the Copilot",
    summary: "How the assistant works: approvals, questions, scope, and context.",
    keywords: ["copilot", "chat", "assistant", "approve", "reject", "ask", "stop", "agent", "history"],
    body: `# Using the Copilot

Open the Copilot from the **Copilot** button (top-right) or with **Ctrl/Cmd+J**. It's a floating window you can drag anywhere, expand, and leave open as you move between pages. It's aware of the page you're on, so you can ask about what's in front of you.

## Approvals
Any change to your data - creating, editing, or archiving a product, adjusting inventory, creating a company, committing an import - shows an **Approve / Reject** card first. Nothing is written until you approve, and both the decision and who made it are recorded.

## Questions
When a choice is genuinely ambiguous - which type an import is, whether to create several new categories - the Copilot asks with concrete options instead of guessing.

## Bulk changes
Changes across many products happen in **one approval**, not one per row. Ask for something like *"set every product's price to 1000"*, *"archive everything from vendor Kush Co"*, or *"zero out on-hand for the Flower category"*, and the Copilot shows a single card with the count ("Update 42 products") before it runs. You can scope a bulk change to everything, a category, a vendor, or a search.

## Stop and history
Press **Stop** to cancel while it's working. The **history** icon lists your past chats; saved **Automations** live on their own page in the sidebar.

## Scope
The Copilot is a Distru assistant. It helps with your workspace and how to use Distru; it won't answer unrelated general questions. Try *"How do I create a product category?"* or *"What's my lowest-stocked product?"*`,
  },
  {
    slug: "automations",
    section: "Copilot",
    title: "Automations",
    summary: "Build workflows as a node graph - AI agents, triggers, and actions that produce and deliver real reports, on a schedule.",
    keywords: ["automation", "automations", "workflow", "workflows", "node graph", "canvas", "agent", "schedule", "scheduled", "cron", "trigger", "webhook", "run now", "unattended", "recurring", "job", "report", "email", "drive"],
    body: `# Automations

An **automation** is a workflow you build as a **node graph** - triggers, AI agents, conditions, and deterministic actions wired together. It follows the n8n model, but an **AI agent is a first-class node**: describe a task in plain language and it plans and calls the tools you give it, right alongside ordinary no-LLM steps.

## The building blocks
- **Triggers** start a run: **Manual** (Run now), **Schedule** (a cron - fires for real), **Webhook**, or **On event**.
- **AI Agent** - an unattended Copilot turn scoped to exactly the **Tool** sub-nodes you wire into it. Give it \`inventory_report\` + \`save_report\` and it builds and saves the report.
- **Action** - runs a single tool with fixed inputs, no LLM. A deterministic step.
- **If** - branches the flow (a true path and a false path).
- **Set** - writes values that later steps read via \`{{ nodes.<id>.summary }}\`.

## Build one
Open **Automations** and either:
- **Draw it on the canvas** - drag nodes from the palette, wire a Tool sub-node into an agent's tool port, and edit each node in the side panel.
- **Generate it** - click **Generate** and describe the automation (*"every weekday at 8am, list products under 25 units and email me the report"*); the AI drafts the whole graph for you to edit.
- **Ask the Copilot** - *"Save an automation that flags every SKU under 10 units each morning"* and approve the card.

Prefer JSON? Toggle **Visual / JSON** to edit the graph document directly - copy it to hand an automation to someone, or paste one in to import it.

## Run and review
**Run** executes the graph and lights up each node's status live. Open **History** for every run, its per-step breakdown, and each agent step's full transcript (the tool calls plus the rendered report). **Scheduled** triggers fire on their cron automatically.

## Real outcomes: produce, deliver, notify
Automations don't just print text - they do real work:
- **save_report** persists the output as a durable **[Report](/docs/reports)** you can view and download.
- **email_report** / **upload_to_drive** deliver that report to an inbox or Google Drive (through the [integrations](/docs/integrations) seam).
- Every completed run drops a **notification** on the topbar bell and the **Notifications** inbox, linking straight to its results.

## Unattended + audited
A chat asks you to approve each change; an automation runs **unattended** and auto-approves its own actions - so write instructions that stand on their own (name the thresholds, the products, and what you want back). Every action is still written to the audit log, attributed to the automation. Review what one does before scheduling it to run repeatedly.`,
  },
  {
    slug: "reports",
    section: "Copilot",
    title: "Reports & delivery",
    summary: "Durable report artifacts the Copilot and automations produce - view, download, email, or upload to Drive.",
    keywords: ["report", "reports", "artifact", "save report", "generate report", "csv", "markdown", "download", "email", "google drive", "deliver", "delivery", "notification", "snapshot"],
    body: `# Reports & delivery

A **Report** is a durable artifact - a saved snapshot of output (Markdown, CSV, or JSON) - that lives in the **Reports** section, separate from the live [Insights](/docs/insights) dashboard.

## Where reports come from
- An **[automation](/docs/automations)** or the **Copilot** calls \`save_report\` to persist its output, or \`generate_report\` to snapshot one of the standard Insights reports.
- The **Insights** page's **Save to Reports** action snapshots any of the 18 standard reports on demand.

## View, download, deliver
Open **Reports** to read a report (Markdown renders as a formatted table), download it, or see where it's been delivered. An automation can **email** a report or **upload it to Google Drive** with \`email_report\` / \`upload_to_drive\` - these run through the [integrations](/docs/integrations) seam, so they cleanly report "not connected" until you wire up an email or Drive provider.

## Notifications
When a report is ready or a workflow finishes, a **notification** appears on the topbar bell and in the **Notifications** inbox (in the nav under Dashboard), each linking straight to the result.`,
  },
  {
    slug: "api-and-integrations",
    section: "Developers",
    title: "API, MCP, and webhooks",
    summary: "Drive Distru from your own systems or agent over the public API.",
    keywords: ["api", "token", "rest", "mcp", "webhook", "integration", "claude code", "cursor", "bearer", "pagination", "upsert", "conventions"],
    body: `# API, MCP, and webhooks

Distru exposes the same data the UI and Copilot use through a public API, an MCP server, and webhooks. Mint an API token on the **Integrations** page (or with \`npm run token\`) and send it as a Bearer token.

## Public REST API
\`\`\`
curl -H "Authorization: Bearer dk_live_..." http://localhost:3000/public/v1/products
\`\`\`

The API follows Distru's conventions so existing Distru integrations feel at home:
- **Bearer auth** with your API token; all IDs are UUIDs.
- **Numbers as strings** (prices, quantities) to preserve precision.
- **Datetimes** in UTC ISO-8601.
- **Enums are uppercase** (\`ACTIVE\`, \`PACKAGE\`, \`VENDOR\`).
- **Fields are always present**, using \`null\` when empty rather than being omitted.
- **Pagination** via a 1-based \`page[number]\` (the primary scheme); every list response carries a \`next_page\` URL for the following page, or \`null\` on the last page. An opaque \`page[after]\` cursor is also accepted.
- **Datetime filtering** with inclusive comma-delimited ranges, e.g. \`updated_datetime=2026-01-01T00:00:00Z,\` (on/after) or \`updated_datetime=,2026-02-01T00:00:00Z\` (on/before), or both for a between.
- **Sparse upsert** on write: omit an \`id\` to create, include it to update; only the fields you send change, and sending \`null\` clears a field.
- **Errors** come back as \`{ "errors": [{ "message", "pointer", "section" }] }\`, where \`pointer\` is a path to the offending value (keys as strings, array indices as integers) and \`section\` is \`body｜query｜path｜header\`. Branch on \`pointer\`/\`section\`, not on \`message\`.

## MCP server
Point Claude Code, Claude Desktop, or Cursor at \`/api/mcp\` with your token to drive Distru from your own agent, using the same tools the built-in Copilot uses. That includes the **analytics/reporting** reads - best sellers (\`distru-top-products\`), a revenue + AR financial summary (\`distru-sales-summary\`), top customers, and the open-invoice / collections report (\`distru-open-invoices\`) - so an external agent can answer "how are sales?" and "who owes us money?", not just mutate records. The **Integrations** page has ready-to-copy connection snippets.

## Webhooks
Register an endpoint to receive events when records change. Deliveries are **HMAC-signed** - verify the \`x-distru-signature: sha256=...\` header against your signing secret - and are **retried with exponential backoff** if your endpoint is unavailable, so a brief outage won't drop events. Manage endpoints under **Settings, Webhooks**.

## OpenAPI
There is a machine-readable spec for all of this - see [API reference (OpenAPI)](/docs/api-reference).`,
  },
  {
    slug: "api-reference",
    section: "Developers",
    title: "API reference (OpenAPI)",
    summary: "The machine-readable OpenAPI spec for the public API, in YAML and JSON.",
    keywords: ["openapi", "swagger", "spec", "api reference", "yaml", "json", "redoc", "postman", "schema", "endpoints", "codegen"],
    body: `# API reference (OpenAPI)

The public API ships a machine-readable **OpenAPI 3.1** description, served live by the app at:

- **[/api/openapi.yaml](/api/openapi.yaml)** - YAML
- **[/api/openapi.json](/api/openapi.json)** - JSON

Load either into **Swagger UI, Redoc, Postman, or Insomnia** to browse and call the API, or feed it to a codegen tool to generate a typed client. The spec documents the auth scheme, every endpoint, request and response schemas, and Distru's conventions (numbers as strings, \`page[number]\` pagination with a \`next_page\` URL - \`page[after]\` also accepted as an opaque cursor, sparse upsert, and the \`{ errors: [...] }\` envelope).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | \`/public/v1/products\` | List products (filters: \`page[number]\`, \`status\`, \`category\`, \`vendor\`, \`search\`) |
| POST | \`/public/v1/products\` | Create or update a product (sparse upsert) |
| GET | \`/public/v1/products/{id}\` | Get one product |
| GET/POST | \`/public/v1/companies\` | List / create companies (customers, vendors, brands) |
| GET | \`/public/v1/product-categories\` | List categories |
| POST | \`/public/v1/adjustments\` | Post a stock adjustment |
| GET/POST | \`/public/v1/orders\`, GET \`/public/v1/orders/{id}\` | Sales orders |
| GET/POST | \`/public/v1/invoices\`, GET \`/public/v1/invoices/{id}\` | Invoices + payments |
| GET/POST | \`/public/v1/purchases\`, GET \`/public/v1/purchases/{id}\` | Purchase orders (receiving adds inventory) |
| GET/POST | \`/public/v1/returns\`, GET \`/public/v1/returns/{id}\` | Customer returns (receiving restocks inventory) |
| GET | \`/public/v1/payments\`, GET \`/public/v1/payments/{id}\` | Payments against invoices |
| GET/POST | \`/public/v1/contacts\`, GET \`/public/v1/contacts/{id}\` | People at companies |
| GET/POST | \`/public/v1/company-groups\` | Company groupings |
| GET | \`/public/v1/locations\`, GET \`/public/v1/unit-types\` | Reference data |

Orders and invoices carry a full money breakdown (\`subtotal\` / \`charge_total\` / \`discount_total\` / \`tax_total\` / \`total\`) with a \`charges\` collection (FEE/DISCOUNT/SHIPPING/TAX); \`custom_data\` and \`tags\` are accepted across products, companies, orders, invoices, and contacts.

Beyond this commerce core, the API scaffolds Distru's **full resource surface** - manufacturing (assemblies/costs), compliance (licenses/COAs), logistics (drivers/vehicles), catalog depth (strains/subcategories/groups/tags/taxes), inventory lots (bins/packages/batches), sales config (payment terms/price tiers/credits/menus), and platform cross-cutting (custom fields/attachments/tasks). Every one is a live, org-scoped REST resource; see [The complete Distru domain](/docs/distru-domain) for the full map and how deeply each is wired, and [/llms.txt](/llms.txt) for the complete endpoint list. The OpenAPI spec above fully types the commerce core; the scaffold resources follow the same list/get/sparse-upsert conventions.

Agents also get first-class resources, mirroring the real Distru API: a compact index at [/llms.txt](/llms.txt), the full docs inlined at [/llms-full.txt](/llms-full.txt), and an Agent Skill of the API conventions at [/skill.md](/skill.md).

Every request needs a Bearer token - mint one under **Settings, API tokens**. For auth details, the MCP server, and webhooks see [API, MCP, and webhooks](/docs/api-and-integrations); for the bulk uploader and the bigger picture see [The import pipeline](/docs/import-pipeline) and [Integrations and the Copilot](/docs/integrations).`,
  },
  {
    slug: "integrations",
    section: "Developers",
    title: "Integrations and the Copilot",
    summary: "How Distru connects to other tools, and where the Copilot is headed across them.",
    keywords: ["integration", "integrations", "google drive", "google sheets", "slack", "quickbooks", "metrc", "connect", "copilot", "ai", "export", "sync"],
    body: `# Integrations and the Copilot

The **Integrations** page connects Distru to the other tools you use. Integrations work across the whole platform - the pages, the public API, and automations all use them - and the **Copilot** benefits too, since it can act through any integration you've connected.

## Available today
- **Your own agent (MCP)** - connect Claude Code, Claude Desktop, Cursor, or any MCP client and read or update your workspace programmatically, using the same tools the Copilot uses. Set it up under **Settings, API tokens**; see **API, MCP, and webhooks** for the details.

## On the roadmap
These appear on the Integrations page as **Coming soon**, grouped by what they do:
- **Files (Google Drive, Google Sheets)** - import catalog and price files and export reports and on-hand back out, keeping the spreadsheets your team already uses in step.
- **Notifications (Slack)** - send alerts and updates to your channels, and act on them without opening the app.
- **Accounting (QuickBooks Online)** - keep customers, invoices, and payments in sync.
- **Compliance (Metrc)** - state track-and-trace for compliant package and transfer reporting.

## How it fits together
An integration is available everywhere at once: as data flowing through the pages and API, as a **trigger or destination for Automations**, and as a **tool the Copilot can call**. Connect it once and the whole platform can use it - which is why a single automation like *"each morning, import the newest price sheet and post a summary to Slack"* can span several integrations through the same harness that runs everything else.`,
  },
  {
    slug: "architecture",
    section: "Platform architecture",
    title: "Architecture overview",
    summary: "A two-piece showcase: a modular Distru platform, with an AI Copilot layered on top.",
    keywords: ["architecture", "design", "modules", "modular monolith", "faces", "harness", "stack", "multitenant", "spec", "overview", "how it works", "two piece", "microservices"],
    body: `# Architecture overview

This project is deliberately **two pieces**, and they are separated in the code, not just in the story:

1. **The platform** - a rewritten Distru: a modular, multitenant ERP domain that stands on its own and is built to grow (and, if ever needed, to split into services). It has *no idea the AI exists*.
2. **The Copilot** - an agentic harness layered **on top of** the platform, plus the answer to the take-home. It depends on the platform; the platform never depends back.

\`\`\`mermaid
flowchart TB
  subgraph Faces["Faces (how work enters)"]
    UI[Web UI]
    REST[Public REST API]
    MCP[MCP server]
    Bulk[Bulk engine]
  end
  subgraph P2["PIECE 2 · Copilot / agentic layer (lib/harness)"]
    Runner[Agent runner · tool registry · HITL gate]
    Conv[Conversations + Automations]
  end
  subgraph P1["PIECE 1 · Platform domain (lib/modules)"]
    Sales[sales]
    Inv[inventory]
    Cat[catalog]
    Plat[platform]
    Imp[imports]
    Kernel[[shared kernel]]
  end
  DB[(Postgres · multitenant · UUIDv7)]
  UI --> P1
  REST --> P1
  MCP --> P1
  Bulk --> Imp
  Conv --> Runner
  Runner --> P1
  Sales --> Inv
  Sales --> Cat
  Cat --> Kernel
  Inv --> Kernel
  Plat --> Kernel
  Imp --> Kernel
  P1 --> DB
\`\`\`

## The organizing idea: one domain, many faces

A single **org-scoped domain layer** is the source of truth, and every way work enters - the UI, the public REST API, the MCP server, the bulk uploader, and the Copilot - is a thin adapter over it. There is exactly one place that knows how to create a product, so chat, the API, and imports never disagree. Adding a capability is one module function plus thin wrappers.

## The two pieces, in code

- **Piece 1 - the platform** lives in \`lib/modules/*\` as bounded-context modules (\`catalog\`, \`inventory\`, \`sales\`, \`platform\`, \`imports\`) over a \`shared\` kernel. Each module exposes a public barrel and hides its internals. This is a **modular monolith** with an enforced dependency direction - see [Modular architecture](/docs/modular-architecture).
- **Piece 2 - the Copilot** lives in \`lib/harness/*\`: a streaming runner, a tool registry, a human-in-the-loop gate, conversation persistence, and automations. It calls the platform's public barrels and is the take-home answer - see [The take-home](/docs/take-home) and [The agentic harness](/docs/harness).

The boundary is real and machine-checked: an ESLint rule forbids any \`lib/modules/**\` file from importing \`@/lib/harness/*\`. The AI sits on top of the domain; the domain can be understood, tested, and shipped without it.

## Stack, and why

- **Next.js 16 (App Router), React 19, TypeScript**, one deploy target (Vercel). The agent loop, the REST API, the MCP server, and the UI live in one codebase with one auth story.
- **Postgres via Drizzle** on the \`postgres.js\` driver, portable from local to Neon.
- **better-auth** with the organization plugin for real multitenancy; **UUIDv7** for auth and domain rows alike, so they share one keyspace.
- **Anthropic \`claude-opus-5\`** by default (streaming, adaptive thinking) - but behind a \`ModelProvider\` seam, so the model vendor is swappable (\`MODEL_PROVIDER=openai\`) without touching the harness. See [The agentic harness](/docs/harness).

Three decisions carry the design:
- **Domain over the database, not over HTTP.** The Copilot's tools call module functions directly, with no internal HTTP hop, so the agent is fast and transactional; REST and MCP call the *same* functions.
- **A manual streaming agent loop**, not the SDK tool-runner, because human-in-the-loop needs to pause a turn mid-stream, persist, and resume across a stateless serverless invocation.
- **Multitenancy at the boundary.** Every module function takes an org-scoped context, so a caller physically cannot read another org's rows.

Read on - **Piece 1:** [Modular architecture](/docs/modular-architecture), [Data model](/docs/data-model). **Piece 2:** [The take-home](/docs/take-home), [The agentic harness](/docs/harness), [The import pipeline](/docs/import-pipeline), [Decisions, scope and building](/docs/building).`,
  },
  {
    slug: "modular-architecture",
    section: "Platform architecture",
    title: "Modular architecture",
    summary: "Bounded-context modules, an enforced dependency graph, and the path to microservices.",
    keywords: ["modular", "modules", "bounded context", "monolith", "microservices", "dependency", "boundaries", "eslint", "scale", "extract", "add a module", "public api", "barrel"],
    body: `# Modular architecture

Piece 1 - the platform - is a **modular monolith**: a single deployable, organized into bounded-context modules with a strict, *machine-enforced* dependency direction. It runs as one process today and can be pulled apart into services later without rewriting the domain, because the seams already exist.

## The modules

Every module lives under \`lib/modules/<context>/\` and exposes a **public barrel** (\`index.ts\`); callers import the barrel, never the files inside.

\`\`\`text
lib/modules/
  shared/      kernel: ServiceCtx (tenancy) · serializers · audit trail
  catalog/       products + reference data (categories, companies, contacts, groups, strains, tags, taxes, locations, unit types)
  inventory/     on-hand ledger, stock adjustments, bins, packages, batches
  sales/         orders, invoices, payments, returns, analytics, price tiers, terms, credits, menus
  purchasing/    purchase orders (buying from vendors; receiving adds stock)
  manufacturing/ assemblies (inputs/outputs/costs), cost types
  compliance/    licenses, license types, test results (COAs), Metrc linkage
  logistics/     drivers, vehicles
  platform/      API tokens, webhooks, audit, custom fields, attachments, tasks
  imports/       import files / jobs / rows (persistence)
\`\`\`

Every Distru resource lives in one of these contexts - see [The complete Distru domain](/docs/distru-domain) for the full resource map and how deep each is wired.

Each context also **owns its tables** in \`db/schema/*\` - \`catalog.ts\`, \`inventory.ts\`, \`sales.ts\`, \`platform.ts\`, \`imports.ts\` - so a module's data and logic sit together. That table ownership is exactly what a future service would take with it.

## The dependency graph (acyclic, layered)

\`\`\`mermaid
flowchart TD
  sales --> inventory
  sales --> catalog
  purchasing --> inventory
  purchasing --> catalog
  catalog --> shared
  inventory --> shared
  purchasing --> shared
  platform --> shared
  imports --> shared
\`\`\`

Dependencies only point **downward**: composite modules (\`sales\`) depend on leaf modules (\`inventory\`, \`catalog\`); every module depends on \`shared\`; nothing depends upward, and there are **no cycles**. The Copilot layer depends on modules; **no module depends on the Copilot**.

## The boundaries are enforced, not just documented

The dependency direction is a build-time rule, so the architecture can't quietly rot as the codebase grows. \`eslint.config.mjs\`:

\`\`\`js
// Import a module's public barrel, never its internals.
{ files: ["**/*.ts"], rules: { "@typescript-eslint/no-restricted-imports":
  ["error", { patterns: [{ group: ["@/lib/modules/*/*"],
    message: "Import @/lib/modules/<module>, not its internals." }] }] } }

// Piece 1 (domain) must not import Piece 2 (the Copilot) or the UI.
{ files: ["lib/modules/**/*.ts"], rules: { "@typescript-eslint/no-restricted-imports":
  ["error", { patterns: [
    { group: ["@/lib/harness", "@/lib/harness/*"], message: "The AI layer depends on the domain, never the reverse." },
    { group: ["@/app/*"], message: "Domain modules must not import the UI/faces." }] }] } }

// The shared kernel depends on nothing else in the domain.
{ files: ["lib/modules/shared/**/*.ts"], rules: { /* forbid ../catalog, ../sales, ... */ } }
\`\`\`

Try to import the harness from a domain module and \`npm run lint\` fails with *"The AI layer depends on the domain, never the reverse."* The boundary bites.

## Adding a module (the platform grows here)

The rest of Distru - manufacturing, compliance - slots in the same way. **Sales** and **purchasing** are the worked examples in this codebase: adding orders + invoicing (and later purchase orders + returns, which post inventory in the opposite direction) meant

1. a schema file (\`db/schema/sales.ts\`) the module owns;
2. a module (\`lib/modules/sales/\`) with an \`index.ts\` barrel, depending downward on \`inventory\` + \`catalog\`;
3. thin wrappers on each face - a REST route, an import target, a UI page, and Copilot tools (the MCP surface comes free: it is [derived from the Copilot tools](/docs/two-faces), not written per-module) -

and **nothing above the module changed**. A new bounded context (e.g. \`purchasing\`) is the same recipe: own its tables, depend downward, expose a barrel, wrap it on the faces.

## The path to microservices

Because each module is a bounded context that owns its tables, communicates through a public API, and never forms a cycle, extracting one is mechanical:

| Seam today | Extraction step |
|---|---|
| Public barrel (\`@/lib/modules/sales\`) | Becomes the service's RPC/HTTP client - callers don't change shape |
| Cross-module call (\`sales → inventory.adjust\`) | Becomes a network call or an emitted domain event |
| Module-owned tables (\`sales.ts\`) | Move with the service into its own database |
| \`ServiceCtx\` (org + actor) | Already the request envelope a service would receive |
| \`audit_log\` + webhooks | Already the cross-cutting event surface |

The point of the modular monolith is to **defer** that cost until scale demands it, while keeping the option open. Today one deploy is simpler, faster (in-process calls, real transactions), and cheaper to operate - and the boundaries are already drawn.`,
  },
  {
    slug: "distru-domain",
    section: "Platform architecture",
    title: "The complete Distru domain",
    summary: "Every Distru resource, mapped to a bounded context, with its implementation depth.",
    keywords: ["domain", "resources", "coverage", "distru", "assemblies", "packages", "batches", "metrc", "licenses", "manufacturing", "compliance", "logistics", "parity", "scope", "rebuild", "map"],
    body: `# The complete Distru domain

This project is framed as a full rebuild of Distru's platform: **every resource in Distru's public API is represented here as a real table + module**, organized into bounded contexts. What varies is *implementation depth*, marked honestly below so nothing is a black box:

- **Live** - fully wired end to end (behavior, inventory/financial effects, all faces).
- **CRUD** - real table + module + REST (list / get / sparse-upsert); no deeper side effects yet.
- **Modeled** - real schema + module; behavior that needs an external system or a larger flow is a documented follow-up (never faked).

## Contexts and resources

### catalog (\`lib/modules/catalog\`)
| Resource | Depth |
|---|---|
| Product, ProductCategory, Company, CompanyGroup, Contact, Location, UnitType | **Live** |
| ProductSubcategory, ProductGroup, Strain, Tag, Tax, OfficialProductCategory | **CRUD** |

### inventory (\`lib/modules/inventory\`)
| Resource | Depth |
|---|---|
| Inventory (append-only ledger), StockAdjustment | **Live** |
| Bin | **CRUD** |
| Package, Batch (Metrc lot tracking) | **Modeled** - lot fields present; Metrc sync deferred |

### sales (\`lib/modules/sales\`)
| Resource | Depth |
|---|---|
| Order (7-status lifecycle), Invoice (payment status + charges/tax/discount breakdown), Payment, Return, Analytics | **Live** |
| PaymentMethod, PaymentTerm, PriceTier, ChargePreset, Menu, Credit | **CRUD** |

### purchasing (\`lib/modules/purchasing\`)
| Resource | Depth |
|---|---|
| Purchase order (receiving increments inventory) | **Live** |

### manufacturing (\`lib/modules/manufacturing\`)
| Resource | Depth |
|---|---|
| Assembly (inputs/outputs/costs), CostType, Cost | **Modeled** - assemblies read/upsert with their lines; posting input/output inventory movements on completion is the documented follow-up |

### compliance (\`lib/modules/compliance\`)
| Resource | Depth |
|---|---|
| License, LicenseType, TestResult (COA) | **CRUD** |
| Metrc (track-and-trace) | **Modeled** - the linkage fields exist (\`metrc_lab_test_id\`, package tags); the live Metrc integration is an external-system follow-up, deliberately not stubbed as if real |

### logistics (\`lib/modules/logistics\`)
| Resource | Depth |
|---|---|
| Driver, Vehicle | **CRUD** - delivery assignment onto an order's fulfillment is the follow-up |

### platform (\`lib/modules/platform\`)
| Resource | Depth |
|---|---|
| API token, Webhook, Audit log, User/Org (better-auth) | **Live** |
| CustomField (definitions), FileAttachment, Task | **CRUD** |

## Why depth is marked, not hidden

Fully building the compliance/manufacturing halves means live Metrc sync, COA ingestion, and assembly costing against real state - external integrations and multi-step flows that can't be honestly "finished" in a clone without the upstream systems. So the **structure** is the whole ERP (every resource is a real, queryable, org-scoped table with a module and, where it's a straightforward record, a REST surface), and the **behavior depth** is labeled. Promoting a **Modeled** resource to **Live** is the same recipe as everywhere else: add the side-effecting service function and wrap it on the faces - the tables, boundaries, and audit trail are already in place. See [Modular architecture](/docs/modular-architecture) for that recipe and [API reference](/docs/api-reference) for the live endpoints.`,
  },
  {
    slug: "data-model",
    section: "Platform architecture",
    title: "Data model",
    summary: "The Postgres schema: org-scoped, UUIDv7, on-hand as a ledger, owned by module.",
    keywords: ["data model", "schema", "database", "drizzle", "postgres", "tables", "products", "inventory", "ledger", "import", "sales", "orders", "invoices", "module ownership"],
    body: `# Data model

Drizzle over Postgres via the \`postgres.js\` driver. Every domain row carries an \`organization_id\` and timestamps, ids are UUIDv7, and numbers are stored \`numeric\` and serialized as strings on the API. The schema is split by **owning module** (\`db/schema/catalog.ts\`, \`inventory.ts\`, \`sales.ts\`, \`platform.ts\`, \`imports.ts\`), so each bounded context's tables travel with it - the seam a future service would extract along. Two tables carry the model's character.

## Products

A product is one catalog item with a SKU unique per organization.

\`\`\`ts
export const products = pgTable("products", {
  id: pk(),                          // uuidv7
  organizationId: uuid().notNull().references(() => organization.id),
  inventoryTrackingMethod: enum().notNull().default("PACKAGE"), // PACKAGE|PRODUCT|BATCH
  name: text().notNull(),
  sku: text().notNull(),             // unique per org
  categoryId: uuid().references(() => categories.id),
  vendorId: uuid().references(() => companies.id),
  unitTypeId: uuid().references(() => unitTypes.id),
  unitPrice: numeric({ precision: 18, scale: 6 }),
  customFields: jsonb().default({}),
  status: enum().default("ACTIVE"),  // ACTIVE|ARCHIVED
  ...timestamps(),
}, (t) => [uniqueIndex("products_org_sku_uq").on(t.organizationId, t.sku)]);
\`\`\`

## Inventory ledger

On-hand is not a column. It is an append-only ledger of movements, so a product's stock is auditable and nothing is silently overwritten.

\`\`\`ts
// on-hand(product, location) = SUM(quantityDelta)
export const inventoryLedger = pgTable("inventory_ledger", {
  id: pk(),
  organizationId: uuid().notNull(),
  productId: uuid().notNull(),
  locationId: uuid().notNull(),
  quantityDelta: numeric({ precision: 18, scale: 6 }).notNull(),
  reason: text().default("adjustment"),
  // "user:<id>" | "agent" | "api" | "import:<jobId>" | "workflow:<id>"
  actor: text().default("system"),
  createdAt: timestamp().defaultNow(),
});
\`\`\`

## The rest of the model, by module

| Module | Tables | Notes |
|---|---|---|
| Tenancy | \`organization\`, \`member\` | better-auth org plugin, UUIDv7 |
| catalog | \`categories\`, \`companies\`, \`company_groups\`, \`contacts\`, \`locations\`, \`unit_types\` | companies carry \`roles[]\` (VENDOR / BRAND / CUSTOMER), \`group_id\`, \`tags[]\`, and custom fields; contacts are people at a company; unit types are a global fixed set |
| sales | \`orders\`, \`order_items\`, \`order_charges\`, \`invoices\`, \`payments\`, \`returns\`, \`return_items\` | order_items snapshot SKU/name; \`order_charges\` are FEE/DISCOUNT/SHIPPING/TAX lines that feed the total; confirming an order posts \`inventory_ledger\` movements; invoices snapshot the order's full financial breakdown; a received return restocks |
| purchasing | \`purchase_orders\`, \`purchase_order_items\` | buying from a vendor; receiving a PO posts an inventory increment - the mirror of a sales decrement |
| imports | \`import_files\`, \`import_jobs\`, \`import_rows\` | the 10k rows live in \`import_rows\`, never in the model |
| platform | \`api_tokens\`, \`webhook_endpoints\`, \`webhook_deliveries\`, \`audit_log\` | tokens SHA-256 hashed; every mutation from every face is audited |
| Copilot (Piece 2) | \`conversations\`, \`messages\`, \`tool_calls\`, \`workflows\`, \`workflow_runs\`, \`artifacts\`, \`notifications\` | messages store raw Anthropic content blocks; tool_calls doubles as the agent audit trail; workflows hold the node graph, workflow_runs the per-node results; artifacts are durable Reports, notifications feed the bell |`,
  },
  {
    slug: "take-home",
    section: "Copilot & take-home",
    title: "The take-home: brief & answer",
    summary: "The AI Product Engineer take-home, and how this project answers it.",
    keywords: ["take-home", "takehome", "instructions", "brief", "exercise", "spec", "harness", "csv", "import", "answer", "mvp", "deferred", "copilot"],
    body: `# The take-home: brief & answer

Piece 2 exists to answer a specific prompt. This page states the brief and maps it to what was built; the mechanics live in [The agentic harness](/docs/harness) and [The import pipeline](/docs/import-pipeline).

## The brief

> Design Distru's **agentic harness**. It must eventually power two products: (1) **automated workflows** on a trigger, connecting to a customer's operational software, and (2) a **Cowork-style chat copilot** that performs one-off actions via the Distru MCP plus the customer's other MCP servers. Incorporate the first use case: **"a customer uploads a CSV of their product catalog and it just works"** - the file is in an unpredictable, per-customer format and can be 100 to 10,000+ rows.

The deliverable was a tech spec. This project is that spec **backed by a runnable implementation**: where the spec says "the harness does X," there is code that does X and a smoke test that exercises it.

## The answer, in one line

Rather than build a one-off CSV importer, build the **harness** the importer rides on - a trigger-agnostic agentic runtime over the modular platform - so the same substrate powers chat today and workflows tomorrow.

## How the brief maps to the build

| The brief asks for | The answer |
|---|---|
| An agentic **harness** | A tool registry + a manual streaming runner + a per-tenant \`AgentContext\`. A capability is a self-describing tool; adding one changes nothing in the loop. |
| **Human-in-the-loop** for real actions | A per-tool \`gate\` (\`none\` / \`confirmation\` / \`question\`). Gated tools pause the turn, persist a \`pending\` row, and **resume across a stateless invocation** - answerable minutes later by a different person. |
| Powers **workflows** *and* **chat** | \`runConversationTurn(ctx, { autoApprove })\`. Chat pauses for approval; an Automation runs the identical loop unattended. The runner has no idea whether a human or a cron fired it. |
| The customer's **other MCP servers** | A tool is just \`{ name, description, inputSchema, gate, execute }\`, so tools discovered from a connected MCP server register alongside the built-ins and inherit the same gate/preview/audit wrapper. |
| **"Throw any CSV in and it works"** | A generic import framework: **detect** the file type (confident / ambiguous / none), **map** arbitrary columns, **validate** every row, **partially commit** the good ones, and hand back a **row-mapped error CSV**. Seven file types, each one file. |
| **100 to 10,000+ rows** | Rows live in Postgres and are processed in chunks; the model only ever sees headers + ~20 sample rows + aggregates. Validate/commit are O(rows) with O(1) model calls. |

## What is MVP, and what is deferred

**MVP (built and runnable):** multitenant auth + orgs; the platform domain (catalog, inventory, sales) + audit; the harness with HITL and resumable state; CSV/XLSX import end-to-end with seven targets; a Distru-faithful REST API, an MCP server, the bulk uploader, and HMAC webhooks; automations that run the harness unattended.

**Deferred (seams already in place):** a queue (QStash / Inngest) for >10k rows and cron triggers - the same chunk functions, a different trigger; **MCP-client ingestion** of a customer's connected servers into the registry; more import targets and fuller API parity; and an **eval harness for column-mapping accuracy**, which is the one place worth investing next because mapping quality is the product.

See [Decisions, scope and building](/docs/building) for the edge-case decisions and the order it was built in.`,
  },
  {
    slug: "harness",
    section: "Copilot & take-home",
    title: "The agentic harness",
    summary: "The tool contract, the streaming runner, and the human-in-the-loop gate.",
    keywords: ["harness", "agent", "runner", "tool", "gate", "human in the loop", "hitl", "approve", "ask_user", "autoapprove", "resume", "streaming"],
    body: `# The agentic harness

Piece 2, the Copilot. It lives in \`lib/harness/\` and sits **on top of** the platform modules - it calls their public barrels and is never called back. A capability is a self-describing tool; the runner is a manual streaming loop that can pause for a human and resume from the database. Nothing lives in server memory between turns.

## The tool contract

\`\`\`ts
type HarnessTool<I> = {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;   // becomes JSON Schema for the model
  gate: "none" | "confirmation" | "question";
  buildPreview?(input, ctx): HarnessToolPreview;   // the approve / ask card
  execute(input, ctx, extra?): Promise<ToolResult>;
};
\`\`\`

The **gate** is the entire safety model, and it is a property of the tool, not the loop:
- \`none\` - read-only, auto-executes.
- \`confirmation\` - a mutation; pauses for approve / reject with a rendered preview.
- \`question\` - the first-class \`ask_user\` path; pauses for a structured answer.

JSON Schema for the model is derived from the same Zod schema that validates input, so a tool cannot describe itself one way and accept another. Tools register in a registry, and **adding a capability is adding a tool** - nothing in the loop changes. Every tool runs against an org-scoped \`AgentContext\`, so multitenancy is enforced here at the tool boundary.

## The runner loop

\`\`\`ts
async function runLoop(ctx, messages, autoApprove = false) {
  const provider = getModelProvider();                // anthropic | openai | ...
  for (step of 0..MAX_STEPS) {                         // capped at 16
    const turn = await provider.streamTurn(            // emits tokens/thinking
      { system, messages, tools: toolSpecs() }, ctx.emit);
    await appendMessage("assistant", turn.content);    // persist canonical blocks
    if (turn.stopReason !== "tool_use") return emit({ type: "done" });

    const results = [], interrupts = [];
    for (tu of turn.toolUses) {
      const tool = getTool(tu.name);
      if (tool.gate === "none") {                     // read - run now
        const res = await tool.execute(tu.input, ctx);
        record(tu, { status: "auto", output: res });
        results.push(toolResult(tu.id, res));
      } else if (autoApprove) {                       // workflow / system trigger
        const res = await tool.execute(tu.input, ctx, { answer: NO_HUMAN });
        record(tu, { status: "auto", requiresConfirmation: true, output: res });
        results.push(toolResult(tu.id, res));
      } else {                                        // human present - gate it
        const preview = await tool.buildPreview(tu.input, ctx);
        record(tu, { status: "pending", preview });
        interrupts.push({ toolUseId: tu.id, name: tu.name, preview });
      }
    }
    if (interrupts.length) return emit({ type: "interrupt", interrupts }); // PAUSE
    await appendMessage("user", results);             // feed back, loop
  }
}
\`\`\`

## Model-agnostic: the provider seam

The loop above never names a vendor. Every model-specific detail lives behind a **\`ModelProvider\`** interface (\`lib/harness/providers/\`), so swapping Claude for GPT (or any OpenAI-compatible endpoint) is one env var - \`MODEL_PROVIDER=openai\` - and changes nothing in the loop, the tools, the gates, or the conversation store.

\`\`\`ts
interface ModelProvider {
  id: string;                    // "anthropic" | "openai" | ...
  model: string;
  isConfigured(): boolean;
  streamTurn(req: { system, messages, tools }, emit): Promise<{
    content;      // assistant message in CANONICAL block form
    stopReason;   // "tool_use" | "end_turn" | ...
    toolUses;     // parsed { id, name, input }[]
  }>;
}
\`\`\`

Two decisions make this clean:

- **A canonical IR.** The harness standardizes on Anthropic's content-block message shape (\`text\` / \`tool_use\` / \`tool_result\` / \`thinking\`) as its internal representation - it's a superset, and it's what we persist. A provider whose wire format differs (OpenAI chat messages, say) translates at **its own edge**, so nothing downstream sees the difference. The bundled \`openai\` provider does exactly this over the Chat Completions streaming API, with no extra dependency.
- **Tools defined once.** \`toolSpecs()\` emits provider-neutral \`{ name, description, inputSchema }\` from the same Zod schemas; each provider maps them into its own tool format. So the same registry that powers the Copilot, the MCP, and now every model vendor stays the single source of truth.

Adding a vendor is one file implementing \`ModelProvider\` plus one line in the provider registry. The customer's own connected MCP servers (QuickBooks, Metrc, Drive) plug in on the *other* side - as tools in the registry (see [One capability, two faces](/docs/two-faces)) - so "our harness, their models, their integrations" is all the same set of seams.

## Human-in-the-loop, serverless-safe

Mutating tools and \`ask_user\` never auto-run. The mechanism:

- **Trigger:** the runner sees a gated tool call, builds a preview, writes a \`pending\` \`tool_calls\` row, emits \`interrupt\`, and closes the stream. No partial \`tool_result\` is sent, so the assistant turn stays open exactly as the API requires.
- **Who can act:** any member of the conversation's org; the decision and actor are recorded on the row.
- **Resume:** the client posts decisions to \`/api/conversations/[id]/resume\`. The server rebuilds history from Postgres and, for every tool call in the last turn, produces a \`tool_result\`: reuse stored output, execute approved mutations now, "User declined" for rejects, pass the answer through for \`ask_user\`. It appends one combined message and re-enters the loop.

The pause can be answered minutes later by a different person on a different invocation, so state lives entirely in Postgres. The SDK tool-runner does not expose this seam, which is the whole reason the loop is hand-written.

\`\`\`mermaid
sequenceDiagram
  participant U as User
  participant R as Runner
  participant DB as Postgres
  participant M as Claude
  U->>R: message
  R->>M: stream turn with tools
  M-->>R: tool_use (mutation)
  R->>DB: persist pending tool_call + preview
  R-->>U: interrupt, Approve or Reject
  U->>R: Approve
  R->>DB: rebuild history, execute tool, audit
  R->>M: continue with tool_result
  M-->>R: final answer
\`\`\`

## Trigger-agnostic, and tools beyond our own

\`runConversationTurn(ctx, { autoApprove: true })\` runs an Automation: gated tools execute immediately instead of pausing, attributed to \`workflow:<id>\`. The runner has no idea whether a human or a cron fired it. And because a tool is just \`{ name, description, inputSchema, gate, execute }\`, tools discovered from a customer's connected MCP servers (QuickBooks, Metrc, Drive) register alongside the built-ins and inherit the same gate, preview, and audit wrapper.

The same shape pays off in the other direction too: because a tool is self-describing, the **same registry is re-exposed as our own MCP server** for external agents to drive - one definition, both faces, no drift. See [One capability, two faces](/docs/two-faces).`,
  },
  {
    slug: "two-faces",
    section: "Copilot & take-home",
    title: "One capability, two faces",
    summary: "How a tool defined once powers both the built-in Copilot and the MCP server.",
    keywords: ["mcp", "mcp bridge", "two faces", "one capability", "tool registry", "derived", "reuse", "harness tool", "external agent", "claude desktop", "cursor", "drift", "single source of truth"],
    body: `# One capability, two faces

Distru's tools have to be usable two ways: through the **built-in Copilot** (a human chatting in-app) and through the **MCP server** (an external agent - Claude Desktop, Cursor, Claude Code - driving Distru over \`POST /api/mcp\`). The rule that keeps them honest: a capability is **defined once** and **surfaced twice**. Add a tool and it appears on both faces automatically; there is no second list to keep in sync.

## The problem this solves

Originally the MCP server hand-wrote its own tool definitions - a parallel \`TOOLS\` array with its own JSON Schemas and its own handlers calling the domain modules. That is duplication with a deadline: the day someone adds \`record_payment\` to the Copilot, the MCP silently lacks it; the day a tool's input changes, the two schemas drift. The external surface was a strictly smaller, staler copy of the internal one.

Now both faces read from the **same harness tool registry**.

## The bridge

\`lib/harness/mcp-bridge.ts\` is the whole adapter. It takes the harness tool arrays the Copilot already runs and re-presents them as MCP tools:

\`\`\`ts
// The domain capabilities offered to external agents.
const EXPOSED = [...catalogTools, ...mutationTools, ...salesTools];

// Harness name (create_order) -> MCP name (distru-create-order).
const mcpName = (n: string) => \`distru-\${n.replace(/_/g, "-")}\`;

export function listMcpTools() {
  return EXPOSED.map((tool) => ({
    name: mcpName(tool.name),
    description: tool.description,
    // JSON Schema derived from the SAME Zod schema the Copilot validates with
    inputSchema: jsonSchema(tool),
  }));
}

export async function callMcpTool(name, args, service: ServiceCtx) {
  const tool = byMcpName.get(name);
  if (!tool) return { ok: false, summary: \`Unknown tool: \${name}\` };
  const parsed = tool.inputSchema.safeParse(args ?? {}); // same validation
  if (!parsed.success) return { ok: false, summary: /* field errors */ };
  const ctx = { service, userId: null, conversationId: "mcp", emit: () => {} };
  return tool.execute(parsed.data, ctx);                 // same execute()
}
\`\`\`

Three things travel across the bridge unchanged, and that is the point:

- **The schema** - \`inputSchema\` is turned into JSON Schema with \`z.toJSONSchema(...)\`, so the MCP tool advertises exactly the shape the tool actually validates. A tool cannot describe itself one way to Claude Desktop and accept another internally.
- **The description** - the same one the model reads in chat, so both agents get the same guidance.
- **The execution** - \`callMcpTool\` runs the tool's own \`execute\`, the identical code path the Copilot runs after a human clicks Approve.

## The MCP route is now thin

\`app/api/mcp/route.ts\` no longer knows anything about products or orders. It is pure JSON-RPC plumbing over the bridge:

\`\`\`ts
if (method === "tools/list") return rpcResult(id, { tools: listMcpTools() });

if (method === "tools/call") {
  const ctx = { orgId: token.orgId, actor: \`mcp:\${token.tokenId}\`, actorType: "api" };
  const result = await callMcpTool(name, args, ctx);
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(result.data ?? result.summary) }],
    isError: !result.ok,
  });
}
\`\`\`

## What about the human-in-the-loop gate?

The Copilot pauses gated (\`confirmation\` / \`question\`) tools for a human to approve. The MCP has no such human at *our* end - **the external agent is its own human-in-the-loop**. So the bridge runs the tool's \`execute\` directly, which is the same code that runs in-app *after* approval. Nothing is bypassed: the mutation still goes through the one domain function, and the \`audit_log\` still records it - attributed to \`mcp:<tokenId>\` rather than a person. Governance lives in the domain, not in the chrome around it.

## What the external surface gets for free

Because the MCP now derives from the registry, the external agent gets the **full** capability set, not the old hand-picked eight: \`update_product\`, \`set_on_hand\`, \`create_invoice\`, \`record_payment\`, \`cancel_order\`, and the bulk operations all appear the moment they exist for the Copilot. Internal-only tools (docs search, the import-job pipeline, automation management) are deliberately left off \`EXPOSED\` because they need chat/session state an external caller doesn't have.

This is the same "one domain, many faces" idea from the [architecture overview](/docs/architecture), applied one level up: there, one module function backs the UI, REST, and MCP; here, one *tool definition* backs both agentic faces. See [The agentic harness](/docs/harness) for the tool contract itself, and [API, MCP, and webhooks](/docs/api-and-integrations) for connecting a client.`,
  },
  {
    slug: "import-pipeline",
    section: "Copilot & take-home",
    title: "The import pipeline",
    summary: "How any CSV becomes catalog: the generic framework, detection, and stages.",
    keywords: ["import pipeline", "csv", "framework", "importtarget", "detection", "mapping", "validate", "commit", "error csv", "scale", "chunk", "engineering"],
    body: `# The import pipeline

Built as a generic framework, not a product-only script, so it scales to other file types. The agent orchestrates and never sees more than headers plus about twenty sample rows; deterministic code does everything at row scale. (For the operator-facing version of this flow, see [Importing data](/docs/importing).)

## The ImportTarget seam

\`\`\`ts
type ImportTarget<Prep, Value> = {
  key; label; description;
  fields: CanonicalField[];              // schema + aliases + fk kinds
  prepare(ctx): Promise<Prep>;           // load reference caches ONCE per run
  validateRow(mapped, prep): ValidateResult<Value>;   // pure, per-row
  commitRows(rows, ctx, prep): Promise<{ productId? }[]>;  // partial-safe
};
\`\`\`

Seven targets ride the same pipeline today: \`products\` (upsert by SKU), \`customers\` and \`vendors\` (CRM companies), \`price-list\` (update prices by SKU), \`inventory-count\` (set on-hand by SKU), \`locations\` (warehouses/rooms), and \`orders\` (line items grouped into draft sales orders). Adding one is a single file; mapping, detection, validation, partial commit, and the error CSV all work for it with zero pipeline changes.

## Add your own type

A new import type is one file plus one line - nothing in the pipeline, the detector, the mapper, or the UI changes. Here is a complete, real target (the \`locations\` one), start to finish:

\`\`\`ts
// lib/imports/targets/locations.ts
export const locationsTarget: ImportTarget<Prep, LocationValue> = {
  key: "locations",
  label: "Locations",
  description: "Import a list of physical locations (warehouses, rooms, sites).",
  fields: [
    {
      key: "name",
      label: "Location Name",
      type: "string",
      required: true,
      // aliases let the auto-mapper match arbitrary source columns
      aliases: ["location", "warehouse", "room", "site", "facility", "address"],
    },
  ],
  // load reference caches ONCE per run (not per row)
  async prepare(ctx) {
    const existing = await listLocations(ctx);
    return { existing: new Set(existing.map((l) => l.name.toLowerCase())) };
  },
  // pure, per-row: coerce + validate, return a typed value or errors
  validateRow(mapped) {
    const name = String(mapped.name ?? "").trim();
    if (!name)
      return { ok: false, errors: [{ field: "name", code: "required", message: "Location Name is required" }] };
    return { ok: true, value: { name } };
  },
  // commit a validated batch; partial success is automatic
  async commitRows(rows, ctx, prep) {
    for (const { value } of rows) {
      if (!prep.existing.has(value.name.toLowerCase())) {
        await createLocation(ctx, { name: value.name });
        prep.existing.add(value.name.toLowerCase());
      }
    }
    return rows.map(() => ({ productId: null }));
  },
};
\`\`\`

Then register it in \`lib/imports/registry.ts\`:

\`\`\`ts
const TARGETS = [productsTarget, customersTarget, /* ... */, locationsTarget];
\`\`\`

That is the whole change. From that moment the agent can **detect** a locations file (the \`aliases\` feed the scorer), **map** its columns, **validate** every row, **commit** the valid ones, and hand back a **row-mapped error CSV** - and the Copilot can say *"I think this is a locations list, import it?"* about a file it has never seen. A totally different type (purchase orders, COAs, price sheets from a new supplier) is the same three steps: canonical fields, validateRow, commitRows.

## Detect first, never guess

\`\`\`ts
// scoreTargets(headers) ranks every target by how well its canonical
// fields match the columns. classifyDetection turns scores into intent:
function classifyDetection(headers): Detection {
  const ranked = scoreTargets(headers);
  if (nothing viable)     return { recommendation: "none" };       // refuse
  if (two+ close winners) return { recommendation: "ambiguous" };  // ask which
  return                  { recommendation: "confident" };         // confirm one
}
\`\`\`

The agent acts on the recommendation and never auto-picks: it confirms on \`confident\`, asks via \`ask_user\` on \`ambiguous\`, and on \`none\` it refuses and imports zero rows. On real inventory, a wrong guess is worse than a question.

## The stages

| # | Stage | Tools |
|---|---|---|
| 1 | **Upload** - parse CSV/XLSX, persist file, headers, sample, and every row | \`POST /api/imports\` |
| 2 | **Detect and confirm intent** - score targets, ask, retarget | \`detect_import_target\`, \`set_import_target\` |
| 3 | **Map columns** - deterministic baseline, model refines the long tail | \`propose_column_mapping\`, \`set_column_mapping\` |
| 4 | **Validate** - chunked at 500; coercion, unknown-unit rejection, new-reference detection; aggregate summary only | \`validate_import\` |
| 5 | **Commit** - gated; upsert valid and warning rows by SKU, partial success | \`commit_import\` |
| 6 | **Error report** - row-mapped CSV (\`_row\`, original columns, \`_errors\`) | \`get_error_report\` |

## Scale, 100 to 10,000+ rows

Rows are persisted and processed in chunks; validate and commit are O(rows) with O(1) model calls (mapping only). In this repo the chunking runs in-process within the serverless duration. Beyond 10k, and for the nightly-sheet workflow, the documented path is a queue (QStash / Inngest) driving the exact same chunk functions. No rewrite, because the pipeline is already chunked and job-backed.`,
  },
  {
    slug: "building",
    section: "Copilot & take-home",
    title: "Decisions, scope and building",
    summary: "Edge-case decisions, what is MVP vs deferred, and the order to build it in.",
    keywords: ["decisions", "edge cases", "product decisions", "mvp", "deferred", "scope", "build", "rebuild", "roadmap", "spec"],
    body: `# Decisions, scope and building

## Edge cases and product decisions

| Situation | Decision | Why |
|---|---|---|
| Arbitrary columns | Model mapping seeded by a deterministic matcher, with fallback | Deterministic handles the 80% cheaply and offline; the model handles the long tail; fallback degrades rather than breaks |
| Ambiguous or unmappable file | Classifier returns confident / ambiguous / none; confirm, ask, or refuse | A wrong guess on real inventory is worse than a question |
| 10k rows vs context | Rows in Postgres; model sees headers, sample, aggregates | Correctness, cost, and scale at once |
| Validation failures | Partial success plus a row-mapped error CSV | 9,850 good rows should not be blocked by 150 bad ones |
| Unknown category / vendor | Flagged as a new reference; created on commit (gated when many) | Onboarding files routinely introduce new brands |
| Unknown unit type | Hard error | Units are a fixed, compliance-relevant set; inventing one is wrong |
| Duplicate SKU | Upsert by SKU (last wins) | Re-uploading a corrected file must be idempotent |
| Prices like "$3.25", "1,200" | Coerced; "twenty" is an error | Obvious coercions succeed; ambiguous ones fail loudly |
| Any mutation | Confirmation gate; the card is the ask | This mutates real inventory; the model should not ask twice in prose |
| Multitenancy | organization_id on every row plus an org-scoped context at the tool boundary | Isolation is structural, not per-query discipline |

## MVP vs deferred

**Built and running:** multitenant auth and org-scoped services with an audit log; the harness (streaming loop, provider-agnostic model seam, HITL confirm and ask_user, resumable) with ~60 tools that operate every domain; import end to end with seven targets, detect to error CSV, 10k rows; five faces on one service layer; a public REST API + MCP spanning 136 self-documented routes with a build-time OpenAPI drift guard; API-accurate mock providers (Metrc/QuickBooks/LeafLink) behind a real seam; a **visual workflow engine** (node-graph automations with AI-agent nodes, real cron scheduling, and a produce → deliver → notify loop: Reports, email/Drive delivery, and notifications); and a **routed operator screen for every domain** - dashboard, insights, reports, notifications, inventory (+ packages/batches/bins), categories, companies, sales (+ returns/credits/payments), purchasing, manufacturing, compliance, cultivation, fleet, automations, reference data, settings, integrations, docs.

**Deferred, seams in place:** queue-backed imports beyond 10k; a durable workflow runtime (Inngest/Temporal) behind the in-process executor, plus live entry points for the webhook/event trigger nodes (cron scheduling already fires); MCP-client ingestion of a customer's connected servers; **live** external sync behind the mock provider seams (real Metrc/QuickBooks/LeafLink adapters, and live email/Drive delivery); the Billing screen (no backend); an eval harness for column-mapping accuracy; RBAC beyond org membership.

## Build it from scratch

If there were no demo, this is the order to rebuild it. Each step depends only on the ones above it, which is what keeps the service layer the single source of truth.

1. **Scaffold** - create-next-app (App Router, TS), Tailwind v4, Drizzle + postgres.js, better-auth with the organization plugin, UUIDv7 across auth and domain rows.
2. **Data model** - author the schema in \`db/schema/*\` and push; every domain table carries organization_id, and on-hand is the ledger, not a column.
3. **Domain modules** - bounded-context modules in \`lib/modules/*\` (\`catalog\`, \`inventory\`, \`sales\`, \`platform\`, \`imports\`) over a \`shared\` kernel, each with a public barrel. Org-scoped, the only code that touches the DB, with an enforced dependency direction.
4. **Harness core** - the tool contract and registry, the streaming runner, the HITL persist/resume, the ask_user gate, and an audit write on every mutation.
5. **Tools** - catalog reads (gate none), mutations (gate confirmation with a preview), the import tools, docs tools, and workflow tools.
6. **Import framework** - the ImportTarget seam, the detection classifier, the mapping matcher, the chunked pipeline, the error-CSV builder, and the seven targets.
7. **Faces** - chat NDJSON routes and \`/resume\`; \`/public/v1/*\` with Distru conventions; the \`/api/mcp\` JSON-RPC server; \`/api/upload-products\`; HMAC-signed webhooks.
8. **Automations** - the workflow tables, the n8n-shaped node-graph model + executor (agent / action / if / set nodes, run against a shared context), \`runWorkflow\` driving the runner with autoApprove, real cron scheduling (a \`tick\` endpoint), the produce → deliver → notify loop (\`save_report\`/\`generate_report\` artifacts, email/Drive delivery, notifications), and the React Flow canvas + JSON builder.
9. **App shell** - the context-driven sidebar, the floating Copilot panel, the dashboard, inventory / companies / categories CRUD, docs, and the integrations directory.
10. **Verify** - typecheck, lint (including the architecture-boundary rules), and a green production build; an offline smoke test that drives the modules and the full import pipeline against Postgres with no model spend; curl each face with a minted token.

The one place worth investing next is an **eval harness for column-mapping accuracy** - mapping quality is the actual product, and it is where regression testing pays for itself immediately.`,
  },
  {
    slug: "returns",
    section: "Selling",
    title: "Returns, credits & payments",
    summary: "Reverse a sale with a return that restocks, record store credit, and see every payment.",
    keywords: ["return", "returns", "credit", "credits", "store credit", "refund", "payment", "payments", "restock", "reverse", "rma", "post-sale"],
    body: `# Returns, credits & payments

Not every sale is final. The **Sales** page carries the whole post-sale flow through its sub-nav: **Orders & invoices**, **Returns**, **Credits**, and **Payments**.

## Returns
A **return** brings product back from a customer. Open **Sales, Returns**, click **New return**, pick the customer (or the originating order), and add the line items and quantities coming back. Receiving a return **restocks inventory** - each returned line posts a positive movement to the on-hand ledger (a \`return\` movement, fully auditable), the mirror of the \`sale\` that took it out. It's the same ledger that backs [inventory](/docs/inventory), so on-hand stays trustworthy.

## Credits
A **credit** is store credit owed to a customer - from a return, a goodwill adjustment, or an overpayment. Record one under **Sales, Credits** with an amount and a reason. An open credit can be **applied to an invoice**, reducing its balance due alongside payments (an invoice's balance is total minus payments minus credits applied).

## Payments
**Sales, Payments** lists every payment recorded against your invoices - amount, method, date, and the invoice it settled. Recording a payment happens from an invoice (see [Sales orders and invoicing](/docs/sales)); this view is the read-across of all of them, so you can see what's come in without opening each invoice one by one.

> The Copilot handles the post-sale flow too: *"Return 3 Blue Dream 3.5g from Green Leaf's last order"* restocks them, and *"apply a $40 credit to INV-0006"* draws down the balance - each behind a single approval.`,
  },
  {
    slug: "packages",
    section: "Catalog",
    title: "Packages, batches & bins",
    summary: "Metrc-style lot units under Inventory: what packages, batches, and bins are, and creating them.",
    keywords: ["package", "packages", "batch", "batches", "bin", "bins", "lot", "metrc tag", "traceability", "storage", "sub-nav"],
    body: `# Packages, batches & bins

Cannabis compliance tracks inventory in discrete, tagged units, not just a running total. Under **Inventory**, the sub-nav splits into **Products**, **Packages**, **Batches**, and **Bins** - the Metrc-style lot units that sit beneath a product's on-hand.

## What each is
- **Package** - a specific, tagged quantity of a product (a Metrc-style package tag identifies it). Packages are how regulated product physically moves and is reported to the state.
- **Batch** - a production or harvest lot that packages descend from; it ties units back to a common source for traceability and recall.
- **Bin** - a storage location within a facility (a shelf, room, or zone) where packages sit. Bins are about *where* stock is, distinct from the [locations](/docs/reference-data) that define your sites.

## Creating them
Open the relevant sub-nav tab and click **New**. A **bin** needs a name; a **batch** captures its source and identifier; a **package** references its product, quantity, and (where present) its Metrc tag and parent batch. Packages and batches carry the lot fields a Metrc sync reads and writes - see [Compliance](/docs/compliance) for how that synced state surfaces read-only in the Metrc view.

> Bins are ordinary catalog records you create, edit, and delete; package and batch lot tracking is modeled with its Metrc linkage in place, so the same units you set up here are what the compliance view reflects.`,
  },
  {
    slug: "purchasing",
    section: "Operations",
    title: "Purchase orders",
    summary: "Buy from vendors: create a PO, work the DRAFT to OPEN to RECEIVED lifecycle, and receive stock in.",
    keywords: ["purchase order", "purchase", "purchasing", "po", "vendor", "buying", "receive", "receiving", "draft", "open", "received", "restock", "procurement"],
    body: `# Purchase orders

Purchasing is how stock comes *in*. A **purchase order** (PO) is a commitment to buy product from a vendor; receiving it is the mirror image of a sale - where a sales order **decrements** on-hand, receiving a PO **increments** it.

## Create a PO
On the **Purchasing** page click **New purchase order**, pick a **vendor** (a company with the VENDOR role - see [Companies](/docs/companies)), and add **line items**: each is a product, a quantity, and a unit cost. Save it and the PO opens in DRAFT.

## The lifecycle
A PO moves through three states:
- **DRAFT** - being built or reviewed. No inventory effect.
- **OPEN** - issued to the vendor and awaiting delivery. Still no stock change.
- **RECEIVED** - the goods arrived. **Receiving the PO increments stock**: every line posts a positive movement to the on-hand ledger (a \`purchase\` movement, attributed and auditable), so your on-hand reflects the delivery the moment you receive it.

Receiving is the only step that moves inventory, and like a sale it happens exactly once.

> The Copilot can do this end to end: *"Draft a PO to Sungrown Farms for 50 Blue Dream 3.5g at $12"* creates it, and *"receive PO-0004"* books the stock in - each human-in-the-loop gated, and available over the MCP server for your own agent to drive.`,
  },
  {
    slug: "manufacturing",
    section: "Operations",
    title: "Assemblies & manufacturing",
    summary: "Turn inputs into outputs with assemblies (BOMs) and roll up their costs.",
    keywords: ["manufacturing", "assembly", "assemblies", "bom", "bill of materials", "production", "inputs", "outputs", "cost", "costs", "cost type", "packaging"],
    body: `# Assemblies & manufacturing

Manufacturing turns inputs into outputs - packaging bulk flower into eighths, building pre-roll multipacks, producing edibles from ingredients. Distru models this as an **assembly**.

## Assemblies and BOMs
An **assembly** is a bill of materials (BOM): a set of **input line items** (the products and quantities consumed) that produce an **output product** (and quantity). On the **Manufacturing** page, click **New assembly**, choose the output product, and add the inputs with their quantities.

## Costs
An assembly can carry **costs** beyond the input products themselves - labor, packaging, overhead - each recorded against a **cost type**. Together with the input product values, these give the output an all-in cost, so margin on the finished good reflects what it actually took to make.

> The Copilot can create assemblies for you: *"Build an assembly that turns 1 lb of Blue Dream bulk into 128 eighths"* - shown for approval first, and callable over the MCP server. Assembly modeling is in place; posting the input/output inventory movements on completion is the documented next step.`,
  },
  {
    slug: "fleet",
    section: "Operations",
    title: "Fleet",
    summary: "Keep your delivery drivers and vehicles ready to assign to outbound orders.",
    keywords: ["fleet", "driver", "drivers", "vehicle", "vehicles", "delivery", "dispatch", "logistics", "van", "truck", "roster"],
    body: `# Fleet

Deliveries need drivers and vehicles. The **Fleet** page is where you keep both, ready to assign to outbound orders.

## Drivers
A **driver** is a person who runs deliveries. Add one with a name and contact details, and maintain the roster as staff change.

## Vehicles
A **vehicle** is a delivery vehicle - a van, truck, or car - tracked by name or plate. Keep the fleet list current so dispatch reflects what's actually on the road.

## Assignment
Drivers and vehicles are maintained here today; attaching them to an order's fulfillment (who is delivering which order, in what vehicle) is the documented follow-up, building on the sales fulfillment lifecycle in [Sales orders and invoicing](/docs/sales).

> Fleet records are ordinary catalog-style entries - create, edit, and delete drivers and vehicles as your operation changes.`,
  },
  {
    slug: "compliance",
    section: "Compliance & Cultivation",
    title: "Compliance: licenses, COAs & Metrc",
    summary: "Manage licenses, record lab results (COAs) with a PDF link, and read your synced Metrc state.",
    keywords: ["compliance", "license", "licenses", "coa", "certificate of analysis", "lab test", "lab results", "metrc", "track and trace", "transfers", "tags", "pdf"],
    body: `# Compliance: licenses, COAs & Metrc

Regulated operators live and die by paperwork. The **Compliance** page keeps your licenses, lab results, and state track-and-trace view in one place.

## Licenses
Record each **license** your business holds - its number, type, and validity - so the details are on hand for reporting and audits. Open **Compliance**, click **New license**, and fill in the license type and identifier.

## Lab results (COAs)
A **test result**, or **Certificate of Analysis (COA)**, captures a lab's potency and safety testing for a product or batch. Record the results and attach a **PDF link** to the COA document, so the certificate is one click from the record it belongs to.

## The Metrc view
Compliance includes a **read-only Metrc view** that reflects your synced state track-and-trace data - **packages**, **transfers**, and **tags** as Metrc sees them. It's populated by the mock Metrc provider behind a real integration seam, so the view shows the shape and flow of synced compliance state without a live state connection. The linkage fields (package tags, lab-test ids) live on your [packages and batches](/docs/packages), so records line up on both sides.

> The Copilot can file compliance records for you: *"Add our California distributor license C11-0000123"* or *"record a COA for batch BD-2409 with this lab PDF"* - each human-in-the-loop gated, and available over the MCP server. The Metrc view stays read-only; syncing to a live state system is the documented follow-up.`,
  },
  {
    slug: "cultivation",
    section: "Compliance & Cultivation",
    title: "Cultivation",
    summary: "Track the grow: plant batches to plants (phase advance) to harvests with wet and dry weight.",
    keywords: ["cultivation", "grow", "plant", "plants", "plant batch", "harvest", "harvests", "phase", "immature", "vegetative", "flowering", "harvested", "wet weight", "dry weight", "strain"],
    body: `# Cultivation

Seed-to-sale starts in the grow. The **Cultivation** page tracks living inventory from clone to harvest, so what you eventually package traces back to the plants it came from.

## The grow lifecycle
- **Plant batches** - a group of plants started together (a propagation run from a strain). Create one under Cultivation with its strain and count.
- **Plants** - the individual plants in a batch. Each advances through the grow **phases**: **IMMATURE → VEGETATIVE → FLOWERING → HARVESTED**. Advancing a plant's phase moves it one step along that lifecycle.
- **Harvests** - when plants reach the end, record a **harvest** capturing **wet weight** and, after drying, **dry weight**. The harvest is what links the finished, weighable product back to the batch and strain that produced it - feeding the [batches and packages](/docs/packages) that carry it forward.

## Creating and advancing
Start a **plant batch** (strain + count), let it grow, and **advance the phase** as the plants develop. At the end, record the **harvest** with its weights.

> The Copilot runs the grow with you: *"Start a plant batch of 24 Blue Dream clones"*, *"advance batch BD-24 to flowering"*, and *"log a harvest of 4,200g wet on batch BD-24"* - each human-in-the-loop gated, and available over the MCP server for your own agent.`,
  },
  {
    slug: "insights",
    section: "Overview",
    title: "Insights & reporting",
    summary: "The analytics dashboard - top products/customers, inventory valuation - and 18 report endpoints over the API.",
    keywords: ["insights", "reporting", "reports", "analytics", "dashboard", "top products", "best sellers", "top customers", "inventory valuation", "revenue", "collections", "metrics"],
    body: `# Insights & reporting

Beyond the day-to-day pages, Distru rolls your data up into analytics - what's selling, who's buying, and what your stock is worth.

## The analytics dashboard
The **Insights** dashboard surfaces the numbers you check most:
- **Top products** - your best sellers by revenue or units over a period.
- **Top customers** - who's buying the most, so you know your key accounts.
- **Inventory valuation** - what your on-hand stock is currently worth.

These read from the same source of truth as every page, so the dashboard never disagrees with the underlying orders and [inventory ledger](/docs/inventory).

## Reporting over the API
The same analytics are available programmatically. Distru exposes **18 report endpoints** over the public API and MCP server - sales summaries (revenue + AR), best sellers, top customers, open-invoice / collections reports, inventory valuation, and more - so an external agent or BI tool can answer "how are sales?" and "who owes us money?" without scraping the UI. See [API, MCP, and webhooks](/docs/api-and-integrations) for connecting a client.

## Save a snapshot to Reports
Each report on the Insights page has a **Save to Reports** action - it snapshots the current numbers as a durable **[Report](/docs/reports)** (Markdown or CSV) you can download or have an [automation](/docs/automations) email out on a schedule. Under the hood the public API, this Insights list, and the \`generate_report\` tool all read a single **report registry**, so the numbers are identical everywhere.

> Ask the Copilot *"what are my top 5 products this month?"* or *"what's my current inventory value?"* - it reads the same reports and answers in chat, no approval needed since nothing changes.`,
  },
  {
    slug: "reference-data",
    section: "Settings",
    title: "Reference data",
    summary: "Curate the shared lists - taxes, price tiers, terms, strains, groups, menus, locations (unit types are read-only).",
    keywords: ["reference data", "settings", "tax", "taxes", "price tier", "payment terms", "payment methods", "strain", "strains", "subcategory", "subcategories", "product group", "company group", "menu", "menus", "location", "unit type"],
    body: `# Reference data

Most pages lean on small shared lists - the taxes you charge, the tiers you price at, the terms you sell on. **Settings** is where you curate that reference data so it's consistent everywhere it's used.

## What you can manage
- **Taxes** - tax rates applied to orders and invoices.
- **Price tiers** - named pricing levels (wholesale, retail, VIP) for customer-specific pricing.
- **Payment terms** - net terms (Net 15, Net 30) offered on invoices.
- **Payment methods** - how payments are recorded (cash, check, ACH, card).
- **Strains** - cannabis strains referenced by products and [cultivation](/docs/cultivation).
- **Subcategories** - finer classification beneath a product [category](/docs/products).
- **Product groups** and **company groups** - groupings for reporting and bulk work.
- **Menus** - curated product lists for sharing or publishing.
- **Locations** - your physical sites (warehouses, rooms), also importable in bulk (see [Importing data](/docs/importing)).

## Managing it
Each list has its own Settings section where you create, rename, and remove entries. One list is deliberately **read-only**: **unit types** (Gram, Ounce, Unit, and so on) are a fixed, compliance-relevant set you pick from but can't invent - the same constraint the [product form](/docs/products) and imports enforce.

> The Copilot leans on this reference data when it works - naming a price tier, a tax, or a strain it already knows - so keeping these lists tidy makes everything else it does more accurate.`,
  },
];

export function listDocs() {
  return DOCS.map(({ slug, section, title, summary }) => ({ slug, section, title, summary }));
}

export function getDoc(slug: string) {
  return DOCS.find((d) => d.slug === slug) ?? null;
}

/** Lightweight keyword search over the docs for the Copilot. */
export function searchDocs(query: string, limit = 5) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = DOCS.map((d) => {
    const hay = {
      title: d.title.toLowerCase(),
      keywords: d.keywords.join(" ").toLowerCase(),
      summary: d.summary.toLowerCase(),
      body: d.body.toLowerCase(),
    };
    let score = 0;
    for (const t of terms) {
      if (hay.title.includes(t)) score += 5;
      if (hay.keywords.includes(t)) score += 4;
      if (hay.summary.includes(t)) score += 2;
      if (hay.body.includes(t)) score += 1;
    }
    return { d, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ d, score }) => ({
    slug: d.slug,
    title: d.title,
    section: d.section,
    summary: d.summary,
    score,
  }));
}
