---
title: "Packages, batches & bins"
section: "Catalog"
summary: "Metrc-style lot units under Inventory: packages with tags and lab-testing state, batches, bins, and the Scan box."
keywords: ["package","packages","batch","batches","bin","bins","lot","metrc tag","barcode","serial","lab testing","coa","traceability","storage","scan","sub-nav"]
order: 22
---
# Packages, batches & bins

Cannabis compliance tracks inventory in discrete, tagged units, not just a running total. The **Inventory** sub-nav includes **Packages**, **Batches**, and **Bins** - the Metrc-style lot units that sit beneath a product's on-hand.

## What each is
- **Package** - a specific, tagged quantity of a product. A package carries a **package tag**, its product, quantity, location, and status (Active, Inactive, Finished, On hold). Underneath, each package also holds the compliance fields a Metrc sync reads and writes - a **Metrc tag**, **barcode**, **serial number**, **lab-testing state**, and sample/production flags - and its **actual per-unit cost** from the FIFO layer it draws on.
- **Batch** - a production or harvest lot that packages descend from; it ties units back to a common source for traceability and recall. A batch carries a number and name, its product, quantity, and optional THC/CBD and manufactured date.
- **Bin** - a storage position within a facility (a shelf, room, or zone) where packages sit. Bins are about *where* stock is, distinct from the [locations](/docs/reference-data) that define your sites.

## Creating and working with them
Open the relevant tab and click **New**. A **bin** needs a name and location; a **batch** captures its number and product; a **package** references its product, quantity, location, tag, and status. Beyond the create form, packages support lot operations - **move** (a cost-preserving transfer between locations), **split**, **finish** (draw the lot down to zero), and **create a test sample** (sends a quantity out for testing and flags the lot as submitted) - available through the Copilot and the [public API](/docs/api-reference).

## The Scan box
The **Packages** tab has a **Scan** box. Type or scan a **package tag, barcode, Metrc tag, serial number, or product SKU**, and Distru resolves it to the matching package or product. Click **Camera** to read a real barcode or QR code with your **phone's rear camera** or a **desktop webcam**. The package edit form has the same per-field camera button to fill a tag by scanning.

## Lab results
A package can carry a **Certificate of Analysis (COA)** - structured potency (THC/CBD % and mg per unit), a pass/fail result, and a link to the COA PDF - recorded on the [Compliance](/docs/compliance) page and tied to the package as its lot-level test result.

> Package and batch lot tracking is modeled with its Metrc linkage in place; the **Metrc** view under Compliance reflects that synced state read-only (see [Compliance](/docs/compliance)). Cultivation can also create a package directly from a harvest - see [Cultivation](/docs/cultivation).
