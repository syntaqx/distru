---
title: "Cultivation"
section: "Compliance & Cultivation"
summary: "Track the grow: plant batches to plants (phases + event timeline) to harvests, then package a harvest into costed inventory."
keywords: ["cultivation","grow","plant","plants","plant batch","harvest","harvests","phase","immature","vegetative","flowering","harvested","event","timeline","wet weight","dry weight","create package","strain"]
order: 27
---
# Cultivation

Seed-to-sale starts in the grow. The **Cultivation** page tracks living inventory from clone to harvest and closes the loop by turning a harvest into real, costed packaged inventory. It has three tabs - **Plant batches**, **Plants**, and **Harvests** - with a header showing plant batches, living plants, and active harvests.

## The grow lifecycle
- **Plant batches** - a group of plants started together (a propagation run from a strain). Create one with its strain, count, and location.
- **Plants** - the individual plants in a batch. Each advances through the grow **phases**: **IMMATURE → VEGETATIVE → FLOWERING → HARVESTED** (with **DESTROYED** as a terminal state). Use the advance control on a plant or batch to move it one phase along.
- **Harvests** - when plants finish, record a **harvest** capturing **wet weight** and, after drying, **dry weight**, plus the plant count and strain. The harvest links the finished, weighable product back to the batch and strain that produced it.

## The event timeline
Every plant and batch keeps an **event timeline**. Phase changes and destroys are **logged automatically** (recording where they came from and went to), and you can log **notes, feedings, and moves** by hand from the plant or batch detail page. The timeline mirrors into the audit trail, so the full history of a plant is always on record.

## Create a package from a harvest
From a harvest's detail page, use **Create package from harvest**: pick the product, a quantity (defaults to the harvest's dry weight), and a location. Distru creates a **package** for that product and posts a **costed stock receipt** (a FIFO cost layer linked to the package and harvest), then marks the harvest **finished**. A harvest can be packaged once - that single step turns dry weight into on-hand, saleable inventory and completes the seed-to-sale chain into [Packages](/docs/packages) and [Inventory](/docs/inventory).

> The Copilot runs the grow with you: *"Start a plant batch of 24 Blue Dream clones"*, *"advance batch PB-0024 to flowering"*, and *"log a harvest of 4,200g wet on batch PB-0024"* - each human-in-the-loop gated, and available over the MCP server.
