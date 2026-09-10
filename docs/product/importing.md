---
title: "Import a CSV or XLSX"
section: "Importing data"
summary: "Drop in any spreadsheet; the Copilot detects, maps, validates, and imports it."
keywords: ["import","csv","xlsx","upload","catalog","mapping","detection","error csv","price sheet","customers","vendors","inventory count","upsert"]
order: 5
---
# Importing data

Drop a CSV or XLSX of **any column layout** onto the Copilot (drag it in, or use the paperclip). You don't have to say what it is or format it a particular way first.

## What happens
1. **Detect** - the Copilot figures out what the file is: a product catalog, price sheet, customer list, vendor/distributor list, inventory count, sales orders, or locations list. If it's ambiguous it asks which; if nothing fits, it tells you and imports nothing rather than guessing.
2. **Map** - it proposes which spreadsheet columns feed which Distru fields (for example `Item #` becomes SKU), and you can correct any mapping.
3. **Validate** - every row is checked. You get counts of valid, warning, and error rows plus the top reasons, without dumping the raw file.
4. **Commit** - after you approve, valid rows are imported. Imports **upsert by SKU**, so re-uploading an updated file changes the matching records instead of creating duplicates. Error rows are skipped.
5. **Error report** - failed rows come back as a downloadable CSV containing your original columns plus the specific error, so you can fix them and re-upload.

## Supported import types
Products, customers, vendors/distributors, price lists (update prices by SKU), inventory counts (set on-hand by SKU), sales orders (line items grouped into draft orders), and locations. Large files - 10,000+ rows - are processed in chunks. New types are added as a single adapter file, so this list grows without touching the import flow (developers: see [The import pipeline](/docs/import-pipeline)).

## Product imports go deep
A product file maps far more than name and SKU. Columns for **UPC**, **MSRP**, **THC %**, **CBD %**, **brand**, **vendor**, **category**, **unit type**, **tracking method**, and a **quantity on-hand** are all recognized - and every field understands the many ways customers name it (`qty`, `quantity`, `on hand`, `stock`, `units`... all map to the same on-hand field). If a column has an **image URL**, the image is downloaded and attached to the product; multiple URLs (comma, pipe, or space separated) attach multiple images. A quantity column sets on-hand at your default location.
