---
title: "Integrations and the Copilot"
section: "Developers"
summary: "Connect QuickBooks, Metrc, LeafLink, BioTrack, Onfleet, Email, and Google Drive; sync and watch the activity feed."
keywords: ["integration","integrations","quickbooks","metrc","leaflink","biotrack","onfleet","google drive","email","connect","disconnect","sync","sync now","activity feed","copilot"]
order: 11
---
# Integrations and the Copilot

The **Integrations** page (under Settings) connects Distru to the other tools you use. An integration is available everywhere at once - the pages, the public API, [automations](/docs/automations), and the **Copilot** can all act through one you've connected.

## Available providers
Distru ships connectors for seven services, grouped by what they do:

| Provider | Category | What it does |
|---|---|---|
| **QuickBooks Online** | Accounting | Push invoices, payments, and customers |
| **Metrc** | Compliance | Pull packages and transfers (state track-and-trace) |
| **LeafLink** | Marketplace | Sync products out, pull orders in |
| **BioTrack** | Compliance | Pull packages and lots |
| **Onfleet** | Logistics | Push deliveries, pull status |
| **Email** | Delivery | Send reports and messages |
| **Google Drive** | Delivery | Upload exports and reports |

## Connect, sync, and review
Each provider has **Connect** / **Disconnect** and a **Sync now** button. Connecting records the connection; **Sync now** runs a sync and drops the results into a **sync-activity feed** that shows each event's provider, direction (push or pull), what moved, whether it succeeded, and when. A completed sync also stamps the last-synced time and posts a notification.

These syncs are **realistic but mocked**: the events are generated deterministically from your workspace's real data (for example, "Pushed 12 invoices to QuickBooks" or "Pulled 30 packages from Metrc"), so you see exactly how the flow behaves without a live account. The connector layer is built as a seam, so a real adapter can drop in behind the same buttons.

## Your own agent (MCP)
The one fully live connection is **your own agent**: point Claude Code, Claude Desktop, Cursor, or any MCP client at Distru's [MCP server](/docs/api-and-integrations) with an API token and read or change your workspace with the same tools the Copilot uses. Set it up under **Settings, API tokens**.

## How it fits together
Connect a provider once and the whole platform can use it - as data through the pages and API, as a **trigger or destination for automations**, and as a **tool the Copilot can call**. That's why a single automation like *"each morning, email me a low-stock report"* can span the report registry and the Email connector through the same harness that runs everything else.
