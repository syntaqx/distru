---
title: "Inventory and on-hand"
section: "Catalog"
summary: "FIFO-costed on-hand, adjustments, transfers between locations, valuation at cost, and the Scan box."
keywords: ["inventory","on hand","on-hand","stock","adjust","set stock","ledger","fifo","cost","cogs","valuation","transfer","transfers","location","audit","scan","barcode","packages","batches","bins"]
order: 2
---
# Inventory and on-hand

On-hand stock is tracked as an **append-only ledger** of movements. A product's on-hand at a location is the sum of its movements, so every change is traceable and nothing is silently overwritten. Every unit also carries a **real cost**: receipts open FIFO cost layers, and issues draw them down oldest-first, so Distru always knows what your stock is worth and what each sale actually cost.

## The Inventory sub-nav
Every Inventory screen shares one sub-nav with six tabs:

- **Products** - the catalog list and on-hand (this page).
- **Packages** - tagged, Metrc-style package units.
- **Batches** - the production/harvest lots packages descend from.
- **Bins** - storage positions within a location.
- **Transfers** - cost-preserving stock moves between locations.
- **Valuation** - what your on-hand is worth, at cost.

Packages, batches, and bins are covered in [Packages, batches & bins](/docs/packages).

## Set or adjust stock
Edit a product and set the **On hand** field. Distru posts the difference between the old and new value as a single adjustment - you set the target you want, and the ledger records the delta. Adjustments flow through the same FIFO engine as every other movement.

## FIFO costing, COGS, and valuation
- **Receiving** stock (from a purchase order, a return, an import, or a manual adjustment up) opens a **cost layer** at that unit cost.
- **Issuing** stock (a sale, a manufacturing input, an adjustment down) draws from open layers **oldest first**, so the cost that leaves is the cost that came in. This is the real **COGS** behind sales-order gross margin.
- **Landed costs** (freight, testing, packaging) can be spread across open layers, raising their unit cost so margin reflects what the goods truly cost.
- The **Valuation** tab lists each product's on-hand quantity, its unit cost, and its **value at cost** (the FIFO value of open layers), with a running total - your inventory's worth at any moment.

## Transfers between locations
The **Transfers** tab moves stock between your locations without changing what it's worth. Click **New transfer**, pick a source and destination location, and add product/quantity lines. Distru FIFO-issues from the source and re-receives the same units into the destination **at their original cost**, so cost travels with the goods. Each transfer gets a number (TR-0001), records the value moved, and is fully auditable.

## The Scan box
The **Packages** tab has a **Scan** box: type or scan a **package tag, barcode, Metrc tag, serial number, or product SKU** and Distru resolves it to the matching package (tag, quantity, status) or product (name, SKU, on-hand). Click **Camera** to scan a real barcode or QR code with your device camera - it works on a **phone's rear camera** and a **desktop/laptop webcam** alike. (Camera scanning needs a secure `https` or `localhost` context.)

## Attribution
Every movement records who made it - a person, the public API, an import, or an automation - in the **audit log**, alongside the reason. This is what makes on-hand trustworthy across all the ways data can change.

> Ask the Copilot *"set Blue Dream 3.5g on-hand to 200"* or *"add 25 to OG Kush"* and approve the card to post the same adjustment.
