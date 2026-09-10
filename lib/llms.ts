import { DOCS } from "@/lib/docs/content";

/**
 * Agent-facing plain-text resources, mirroring what the real Distru API serves:
 *   /llms.txt       - a compact, link-first index (llmstxt.org convention)
 *   /llms-full.txt  - the full docs inlined as one Markdown file
 *   /skill.md       - an Agent Skill: the API/MCP conventions an agent must know
 *
 * All three are generated from the SAME docs (lib/docs/content.ts) the humans and
 * the Copilot read, so an external agent, our Copilot, and the docs pages never
 * describe the platform differently.
 */

/** The conventions cheat-sheet - the load-bearing facts an agent needs up front. */
function conventions(): string {
  return `## API conventions (read before calling)

- **Auth:** \`Authorization: Bearer <token>\`. Mint a token under Settings, API tokens (\`dk_live_...\`). Tokens are org-scoped and SHA-256 hashed at rest.
- **IDs:** UUID strings, opaque. Do not parse them.
- **Numbers:** serialized as **quoted strings** to preserve precision, e.g. \`"25.000000"\`, \`"5"\`. Parse before doing math.
- **Datetimes:** UTC ISO-8601 with microseconds, e.g. \`"2026-09-08T04:40:21.817570Z"\`.
- **Enums:** UPPERCASE tokens, e.g. \`ACTIVE\`, \`PACKAGE\`, \`VENDOR\`, \`PROCESSING\`, \`FULLY_PAID\`.
- **Nulls:** fields are always present; empty values are \`null\`, never omitted.
- **Pagination:** 1-based \`page[number]=<n>\` is the primary scheme; every list response carries a \`next_page\` URL for the following page (\`null\` on the last page). Do not assume a fixed page size. An opaque \`page[after]=<token>\` cursor is also accepted.
- **Datetime filtering:** comma-delimited inclusive ranges, e.g. \`updated_datetime=2026-01-01T00:00:00Z,\` (on/after), \`updated_datetime=,2026-02-01T00:00:00Z\` (on/before), or both for a between.
- **Upsert (sparse):** one \`POST\` per resource does create and update. Omit \`id\` to create; include \`id\` to update (only the fields you send change); send a field as \`null\` to clear it.
- **Errors:** \`{ "errors": [{ "message", "pointer", "section" }] }\`. \`pointer\` is a path to the offending value (object keys as strings, array indices as integers, e.g. \`["items", 0, "sku"]\`); \`section\` is \`body | query | path | header\`. Branch on \`pointer\`/\`section\`, not on \`message\` text.
- **Status codes:** \`400\` invalid request / business-rule violation, \`401\` missing/invalid token, \`403\` token lacks scope, \`404\` not found for your org.`;
}

/** The list of REST resources, grounded in the actual /api/v1 routes. */
function endpoints(): string {
  return `## REST resources (\`/api/v1\`)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | \`/products\`, GET \`/products/{id}\` | Catalog items (sparse upsert by id or sku) |
| GET/POST | \`/companies\` | Customers, vendors, brands |
| GET | \`/product-categories\` | Product categories |
| POST | \`/adjustments\` | Move on-hand by a relative delta |
| GET/POST | \`/orders\`, GET \`/orders/{id}\` | Sales orders (confirming moves inventory) |
| GET/POST | \`/invoices\`, GET \`/invoices/{id}\` | Invoices + payments |
| GET/POST | \`/purchases\`, GET \`/purchases/{id}\` | Purchase orders (receiving adds inventory) |
| GET/POST | \`/returns\`, GET \`/returns/{id}\` | Customer returns (receiving restocks inventory) |
| GET | \`/payments\`, GET \`/payments/{id}\` | Payments recorded against invoices |
| GET/POST | \`/contacts\`, GET \`/contacts/{id}\` | People at companies (sparse upsert) |
| GET/POST | \`/company-groups\` (+ id) | Company groupings (sparse upsert) |
| GET | \`/locations\` (+ id), GET \`/unit-types\` (+ id) | Reference data (warehouses; Gram/Ounce/Unit) |
| GET/POST | \`/strains\`, \`/product-subcategories\`, \`/product-groups\`, \`/tags\`, \`/taxes\` (+ GET \`/official-product-categories\`) | Catalog depth |
| GET/POST | \`/bins\`, \`/packages\`, \`/batches\` | Inventory positions + Metrc lots (lot fields modeled; Metrc sync deferred) |
| GET/POST | \`/payment-methods\`, \`/payment-terms\`, \`/price-tiers\`, \`/charge-presets\`, \`/menus\`, \`/credits\` | Sales configuration |
| GET/POST | \`/assemblies\` (+ id), \`/cost-types\` (+ id), \`/costs\` | Manufacturing (assembly line posting deferred) |
| GET/POST | \`/licenses\` (+ id), \`/license-types\`, \`/test-results\` (+ id) | Compliance (licenses, COAs) |
| GET/POST | \`/drivers\` (+ id), \`/vehicles\` (+ id) | Logistics |
| GET/POST | \`/custom-fields\`, \`/file-attachments\`, \`/tasks\` (each + id) | Platform cross-cutting |

Orders and invoices carry a full money breakdown (\`subtotal\`, \`charge_total\`, \`discount_total\`, \`tax_total\`, \`total\`) with a \`charges\` collection (FEE/DISCOUNT/SHIPPING/TAX), plus \`billing_location\`/\`shipping_location\`, \`tags\`, and \`custom_data\`. \`custom_data\` (\`[{id,name,value}]\`) and \`tags\` are accepted on products, companies, orders, invoices, and contacts.`;
}

/** Machine-readable + agentic entry points. */
function faces(base: string): string {
  return `## Machine-readable specs & agent access

- OpenAPI 3.1: [${base}/api/openapi.json](${base}/api/openapi.json) · [${base}/api/openapi.yaml](${base}/api/openapi.yaml)
- MCP server (JSON-RPC over Streamable HTTP): \`POST ${base}/api/mcp\` with your Bearer token. Its tool list is derived from the same registry the built-in Copilot uses, so it exposes the full surface - catalog + inventory + sales mutations plus analytics (best sellers, revenue/AR, collections). \`GET ${base}/api/mcp\` lists the live tool names.
- This file: [${base}/llms.txt](${base}/llms.txt) · full docs: [${base}/llms-full.txt](${base}/llms-full.txt) · agent skill: [${base}/skill.md](${base}/skill.md)`;
}

/** llmstxt.org-style compact index: title, summary, then links by section. */
export function buildLlmsTxt(base: string): string {
  const bySection = new Map<string, typeof DOCS>();
  for (const d of DOCS) {
    const arr = bySection.get(d.section) ?? [];
    arr.push(d);
    bySection.set(d.section, arr);
  }
  const docLinks = [...bySection.entries()]
    .map(
      ([section, docs]) =>
        `### ${section}\n` +
        docs.map((d) => `- [${d.title}](${base}/docs/${d.slug}): ${d.summary}`).join("\n"),
    )
    .join("\n\n");

  return `# Distru

> Distru is a seed-to-sale ERP for licensed cannabis operators. This platform exposes its catalog, inventory, companies (CRM), and sales (orders/invoices/payments) through a public REST API, an MCP server, and webhooks. An AI Copilot drives the same capabilities through conversation; the MCP server exposes those same capabilities to any external agent.

${conventions()}

${endpoints()}

${faces(base)}

## Documentation

${docLinks}`;
}

/** The full docs, inlined as one Markdown document. */
export function buildLlmsFullTxt(base: string): string {
  const articles = DOCS.map(
    (d) => `<!-- ${d.section} / ${d.slug} -->\n\n${d.body}`,
  ).join("\n\n---\n\n");
  return `# Distru - full documentation

> Generated from the in-product documentation. Everything the platform supports, in reading order.

${conventions()}

${endpoints()}

${faces(base)}

---

${articles}`;
}

/** An Agent Skill: the conventions an agent should keep loaded while using Distru. */
export function buildSkillMd(base: string): string {
  return `---
name: distru-api
description: Conventions for calling the Distru public REST API and MCP server - auth, number/date/enum/null serialization, page-number pagination, sparse upsert, and the error envelope. Load this before making Distru API calls.
---

# Distru API skill

You are calling the Distru API (a seed-to-sale cannabis ERP) for a single organization, authenticated by a Bearer token. Keep these conventions loaded.

${conventions()}

${endpoints()}

## Working rules

- **Read before you write.** List or GET to resolve a name to an id (or confirm a SKU) before you POST. Never invent ids or SKUs.
- **Upsert is sparse.** To update, send \`id\` plus only the fields that change. Sending a whole object can clear fields you did not mean to touch (send \`null\` only to clear on purpose).
- **Money is a string.** Parse \`"25.000000"\` before arithmetic; send numbers as JSON numbers on write.
- **Handle errors structurally.** On non-2xx, read \`errors[].pointer\` and \`errors[].section\` to find the bad field; do not pattern-match \`message\`.
- **Paginate to completion.** Follow \`next_page\` until it is \`null\`; do not assume one page is the whole set.

${faces(base)}`;
}
