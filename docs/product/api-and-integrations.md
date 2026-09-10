---
title: "API, MCP, and webhooks"
section: "Developers"
summary: "Drive Distru from your own systems or agent over the public API."
keywords: ["api","token","rest","mcp","webhook","integration","claude code","cursor","bearer","pagination","upsert","conventions"]
order: 9
---
# API, MCP, and webhooks

Distru exposes the same data the UI and Copilot use through a public API, an MCP server, and webhooks. Mint an API token on the **Integrations** page (or with `npm run token`) and send it as a Bearer token.

## Public REST API
```
curl -H "Authorization: Bearer dk_live_..." http://localhost:3000/public/v1/products
```

The API follows Distru's conventions so existing Distru integrations feel at home:
- **Bearer auth** with your API token; all IDs are UUIDs.
- **Numbers as strings** (prices, quantities) to preserve precision.
- **Datetimes** in UTC ISO-8601.
- **Enums are uppercase** (`ACTIVE`, `PACKAGE`, `VENDOR`).
- **Fields are always present**, using `null` when empty rather than being omitted.
- **Pagination** via a 1-based `page[number]` (the primary scheme); every list response carries a `next_page` URL for the following page, or `null` on the last page. An opaque `page[after]` cursor is also accepted.
- **Datetime filtering** with inclusive comma-delimited ranges, e.g. `updated_datetime=2026-01-01T00:00:00Z,` (on/after) or `updated_datetime=,2026-02-01T00:00:00Z` (on/before), or both for a between.
- **Sparse upsert** on write: omit an `id` to create, include it to update; only the fields you send change, and sending `null` clears a field.
- **Errors** come back as `{ "errors": [{ "message", "pointer", "section" }] }`, where `pointer` is a path to the offending value (keys as strings, array indices as integers) and `section` is `body｜query｜path｜header`. Branch on `pointer`/`section`, not on `message`.

## MCP server
Point Claude Code, Claude Desktop, or Cursor at `/api/mcp` with your token to drive Distru from your own agent, using the same tools the built-in Copilot uses (around 65 of them, generated from the one service layer both faces share). That includes the **analytics/reporting** reads - best sellers (`distru-top-products`), a revenue + AR financial summary (`distru-sales-summary`), top customers (`distru-top-customers`), and the open-invoice / collections report (`distru-open-invoices`) - so an external agent can answer "how are sales?" and "who owes us money?", not just mutate records. The **Integrations** page has ready-to-copy connection snippets.

## Webhooks
Register an endpoint to receive events when records change. Deliveries are **HMAC-signed** - verify the `x-distru-signature: sha256=...` header against your signing secret - and every delivery is logged with its response status, so you can see what was sent and whether it landed. Manage endpoints under **Settings, Webhooks**, where you choose which events an endpoint subscribes to.

## OpenAPI
There is a machine-readable spec for all of this - see [API reference (OpenAPI)](/docs/api-reference).
