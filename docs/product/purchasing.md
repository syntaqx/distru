---
title: "Purchase orders"
section: "Operations"
summary: "Buy from vendors: create a PO, work the DRAFT to OPEN to RECEIVED lifecycle, and receive stock in at actual cost."
keywords: ["purchase order","purchase","purchasing","po","vendor","buying","receive","receiving","draft","open","received","cost","fifo","restock","procurement"]
order: 23
---
# Purchase orders

Purchasing is how stock comes *in*. A **purchase order** (PO) is a commitment to buy product from a vendor; receiving it is the mirror image of a sale - where a sales order **decrements** on-hand, receiving a PO **increments** it.

## Create a PO
On the **Purchasing** page click **New purchase order**, pick a **vendor** (a company with the VENDOR role - see [Companies](/docs/companies)), and add **line items**: each is a product, a quantity, and a unit cost. You set the PO's starting status - it defaults to **Open**, with **Draft** available for one you haven't placed yet.

## The lifecycle
A PO moves through three states:
- **DRAFT** - being built or reviewed. No inventory effect.
- **OPEN** - issued to the vendor and awaiting delivery. Still no stock change.
- **RECEIVED** - the goods arrived. **Receiving the PO increments stock**: every line posts a positive movement to the on-hand ledger at the line's **actual unit cost**, opening a FIFO cost layer at exactly what you paid. That cost is what later flows out as COGS when the product sells, so margin traces back to the real purchase price.

Use the **Receive** button to book the goods in. Receiving is the only step that moves inventory, and like a sale it happens exactly once; canceling a received PO reverses the stock.

> The Copilot can do this end to end: *"Draft a PO to Sungrown Farms for 50 Blue Dream 3.5g at $12"* creates it, and *"receive PO-0004"* books the stock in - each human-in-the-loop gated, and available over the MCP server for your own agent to drive.
