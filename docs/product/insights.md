---
title: "Insights & reporting"
section: "Overview"
summary: "The analytics dashboard - revenue, AR, top products/customers, inventory valuation - plus two dozen registry-driven reports."
keywords: ["insights","reporting","reports","analytics","dashboard","top products","best sellers","top customers","inventory valuation","ar aging","margin","cogs","revenue","metrics"]
order: 28
---
# Insights & reporting

Beyond the day-to-day pages, Distru rolls your data up into analytics - what's selling, who's buying, what you're owed, and what your stock is worth.

## The analytics dashboard
The **Insights** dashboard opens on a period selector (7d, 30d, 90d, 12m, YTD, all time) and surfaces the numbers you check most:
- **Headline stats** - booked revenue, order count, outstanding AR, active products.
- **Top products** - your best sellers by revenue or units.
- **Top customers** - who's buying the most, so you know your key accounts.
- **Sales summary** - revenue, units, average order value, and invoiced/collected/outstanding.
- **Inventory valuation** - what your on-hand is worth.

These read from the same source of truth as every page, so the dashboard never disagrees with the underlying orders and [inventory ledger](/docs/inventory).

## The report library
Below the dashboard, **Available reports** lists Distru's full report catalog - around **two dozen** reports driven by a single registry. They span sales (including a month-by-month **sales matrix** and **margin-by-product**), financials (**AR aging**, payments received), inventory and **COGS** (including **inventory valuation** at FIFO cost and low-stock/reorder), and purchasing. Each row opens the live numbers and offers a **Save snapshot to Reports** action.

Because the public API, this Insights list, and the Copilot's `generate_report` tool all read that one registry, the numbers are identical everywhere - see [Reports & delivery](/docs/reports) for saved snapshots and [API, MCP, and webhooks](/docs/api-and-integrations) for pulling them programmatically.

> Ask the Copilot *"what are my top 5 products this month?"*, *"who owes us money?"*, or *"what's my current inventory value?"* - it reads the same reports and answers in chat, no approval needed since nothing changes.
