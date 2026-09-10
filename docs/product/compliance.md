---
title: "Compliance: licenses, COAs & Metrc"
section: "Compliance & Cultivation"
summary: "Track licenses with expiry alerts, record COAs with structured potency, read your Metrc state, and print COA and manifest PDFs."
keywords: ["compliance","license","licenses","expiry","coa","certificate of analysis","potency","thc","cbd","lab test","lab results","metrc","track and trace","transfers","manifest","tags","pdf"]
order: 26
---
# Compliance: licenses, COAs & Metrc

Regulated operators live and die by paperwork. The **Compliance** page keeps your licenses, lab results, and state track-and-trace view in one place, across three tabs - **Licenses**, **Test Results**, and **Metrc** - with a header showing active licenses, licenses expiring soon, COAs on file, and Metrc packages.

## Licenses
Record each **license** - its number, type, state, and validity dates. A license can belong to your own business or be **linked to a company** (a customer or vendor), so you can hold your counterparties' licenses on file too. Distru tracks validity for you:

- **Expiry alerts** - the page flags licenses expiring within 30 days and shows days-left per license; an expired license never reads as active.
- **Sale-time validation** - Distru can check that a customer holds a currently valid license before you sell to them, with a clear reason when one is missing or expired.

## Lab results (COAs)
A **test result**, or **Certificate of Analysis (COA)**, captures a lab's testing for a product or a specific package. COAs carry **structured potency** - THC % and CBD %, plus THC and CBD **mg per unit** - along with a **pass/fail** result, the tested date, a **Metrc lab test id**, and a link to the **COA PDF**. A COA can be tied to a **package** (lot-level), so the certificate is one click from the exact units it covers, and Distru can print a COA PDF on demand.

## The Metrc view
Compliance includes a **read-only Metrc view** that reflects state track-and-trace data - **packages, transfers, tags, strains, items, and required lab-test batches** as Metrc sees them. It is powered by a **mock Metrc provider** (clearly labeled as such in the view): the rows are shaped exactly like Metrc's real schemas and derived deterministically from your own catalog and inventory, so you see the shape and flow of synced compliance state without a live state connection. The linkage fields (package tags, lab-test ids) live on your [packages and batches](/docs/packages), so records line up on both sides.

## PDFs and manifests
Beyond COA PDFs, Distru generates a **transfer manifest PDF** for a stock [transfer](/docs/inventory) (Metrc-style, with line items and moved cost), plus order and invoice PDFs from the [Sales](/docs/sales) pages.

> The Copilot can file compliance records for you: *"Add our California distributor license C11-0000123"* or *"record a COA for batch BD-2409 with this lab PDF"* - each human-in-the-loop gated, and available over the MCP server.
