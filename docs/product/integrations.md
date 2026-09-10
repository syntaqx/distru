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
Distru ships connectors for nine services, grouped by what they do:

| Provider | Category | What it does |
|---|---|---|
| **QuickBooks Online** | Accounting | Push invoices, payments, and customers |
| **Xero** | Accounting | Push invoices, payments, and contacts (QuickBooks alternative) |
| **Sage Business Cloud** | Accounting | Push invoices and customers (QuickBooks alternative) |
| **Metrc** | Compliance | Pull packages and transfers (state track-and-trace) |
| **LeafLink** | Marketplace | Sync products out, pull orders in |
| **BioTrack** | Compliance | Pull packages and lots |
| **Onfleet** | Logistics | Push deliveries, pull status |
| **Email (SMTP)** | Delivery | Send reports and messages |
| **Google Drive** | Delivery | Upload exports and reports |

Accounting is a **pick-one** category: QuickBooks, Xero, and Sage cover the same job for teams standardized on different books.

## Set up, then connect
An integration starts at **Setup required**. Hit **Set up** and enter that provider's real credentials - QuickBooks wants an OAuth client id/secret and your company (realm) id; Metrc wants your state plus a vendor and user API key; Onfleet wants an API key; and so on. Secrets are shown as a *saved* placeholder once stored and never sent back to your browser in the clear. The moment every required field is filled, the provider **connects** and **Sync now** unlocks - so nothing can sync until it's genuinely set up, exactly as a live account would require.

You can **Configure** a connected provider again at any time (to rotate a key), **Disconnect** it (which keeps your credentials so you can reconnect in one click), and watch what each sync did.

## Sync and review
**Sync now** runs a sync and drops the results into a **sync-activity feed** that shows each event's provider, direction (push or pull), what moved, whether it succeeded, and when. A completed sync also stamps the last-synced time and posts a notification.

**Mock vs. live is decided by your credentials.** The seam is **config-aware**: enter *real* credentials and a provider switches from the believable mock to a **live adapter that calls the vendor's API for real** - full OAuth2 (a "Connect with QuickBooks/Xero/Sage" redirect that stores + refreshes tokens) for accounting, REST for Metrc/LeafLink/Onfleet/BioTrack, and live SMTP for Email. A **● Live** badge marks a provider running against its real API. The seeded demo keeps fake credentials on the mock path, so "Pushed 12 invoices to QuickBooks" and "Pulled 30 packages from Metrc" still show the flow without a live account. Road routing for the [dispatch map](/docs/fleet) is always live.

## From the Copilot, too
The Copilot can operate this surface end to end: `list_integrations` (with each provider's required setup fields), `configure_integration` (enter credentials, human-approved), `connect_integration`, `disconnect_integration`, and `sync_integration` - so "set up Onfleet with this key and sync it" is a single conversation.

## Your own agent (MCP)
The one fully live connection is **your own agent**: point Claude Code, Claude Desktop, Cursor, or any MCP client at Distru's [MCP server](/docs/api-and-integrations) with an API token and read or change your workspace with the same tools the Copilot uses. Set it up under **Settings, API tokens**.

## How it fits together
Connect a provider once and the whole platform can use it - as data through the pages and API, as a **trigger or destination for automations**, and as a **tool the Copilot can call**. That's why a single automation like *"each morning, email me a low-stock report"* can span the report registry and the Email connector through the same harness that runs everything else.
