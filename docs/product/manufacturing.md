---
title: "Assemblies & manufacturing"
section: "Operations"
summary: "Turn inputs into costed outputs with assemblies, reserve stock, schedule runs, and Start/Complete to post inventory."
keywords: ["manufacturing","assembly","assemblies","bom","bill of materials","production","inputs","outputs","cost","cost type","reservation","reserved","available","schedule","start","complete","packaging"]
order: 24
---
# Assemblies & manufacturing

Manufacturing turns inputs into outputs - packaging bulk flower into eighths, building pre-roll multipacks, producing edibles from ingredients. Distru models this as an **assembly**, and a completed run posts real, FIFO-costed inventory movements. The **Manufacturing** page has three tabs: **Assemblies**, **Schedule**, and **Costs**.

## Assemblies and BOMs
An **assembly** is a bill of materials (BOM): a set of **input line items** (the products and quantities consumed) that produce an **output product** (and quantity). Click **New assembly**, choose the output product, and add the inputs with their quantities. Each product shows its **available** figure - on-hand minus what other runs have reserved - so you can see whether you can build.

## Costs
An assembly can carry **costs** beyond the input products themselves - labor, packaging, overhead - each recorded against a **cost type** on the Costs tab. These roll into the finished good's cost so margin reflects what it actually took to make.

## Reserving, scheduling, and running
An assembly run moves through **Pending → In progress → Completed** (or Canceled):

- **Start run** (Pending → In progress) opens a **soft reservation** for each input at the run's location. Reservations don't move any stock - they just hold it, so **available = on-hand − reserved** across the workspace and two runs can't plan to consume the same units.
- **Complete run** releases the holds and **posts the inventory**: it consumes each input **FIFO** (accumulating the run's real input COGS), adds the applied costs, rolls a single **unit cost = total cost ÷ total output quantity**, and produces each output as a new costed FIFO lot. If any input is short at completion, the whole run is blocked and nothing is consumed. Completing is what posts - there's no separate step - and it happens exactly once.

The **Schedule** tab is your production plan: assemblies with a planned start date, grouped by day, showing the time, estimated work, assignee, and whether inputs are reserved or short. Set a start date, estimated minutes, and an assignee on the assembly to put a run on the schedule.

> The Copilot can create assemblies for you: *"Build an assembly that turns 1 lb of Blue Dream bulk into 128 eighths"* - shown for approval first, and callable over the MCP server.
