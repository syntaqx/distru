---
title: "The complete Distru domain"
section: "Platform architecture"
summary: "Every Distru resource, mapped to a bounded context, with its implementation depth."
keywords: ["domain","resources","coverage","distru","assemblies","packages","batches","metrc","licenses","manufacturing","compliance","logistics","parity","scope","rebuild","map"]
order: 102
---
# The complete Distru domain

This project is framed as a full rebuild of Distru's platform: **every resource in Distru's public API is represented here as a real table + module**, organized into bounded contexts. What varies is *implementation depth*, marked honestly below so nothing is a black box:

- **Live** - fully wired end to end (behavior, inventory/financial effects, all faces).
- **CRUD** - real table + module + REST (list / get / sparse-upsert); no deeper side effects yet.
- **Modeled** - real schema + module; behavior that needs an external system or a larger flow is a documented follow-up (never faked).

## Contexts and resources

### catalog (`lib/modules/catalog`)
| Resource | Depth |
|---|---|
| Product (pricing, cost, barcode, potency, brand/strain), ProductImage, ProductCategory, Company, CompanyGroup, CompanyNote (CRM timeline), Contact, Location, UnitType | **Live** |
| ProductSubcategory, ProductGroup, Strain, Tag, Tax, OfficialProductCategory | **CRUD** |

### inventory (`lib/modules/inventory`)
| Resource | Depth |
|---|---|
| Inventory (append-only ledger over FIFO cost layers - real COGS + valuation), StockAdjustment, StockTransfer (multi-location, cost-preserving, audited) | **Live** |
| Package (Metrc trace fields: tag/barcode/serial/lab-state/flags; move / finish / split; scan lookup), Batch (potency/name), Bin | **Live** - lot-level identity is real; live Metrc sync is mocked behind the integration seam |

### sales (`lib/modules/sales`)
| Resource | Depth |
|---|---|
| Order (status lifecycle, stock posts on ship with real COGS), Invoice (payment status + charges/tax/discount breakdown, void), Payment, Return (restocks), Credit, Analytics | **Live** |
| PaymentMethod, PaymentTerm, PriceTier, ChargePreset, Menu | **CRUD** |

### purchasing (`lib/modules/purchasing`)
| Resource | Depth |
|---|---|
| Purchase order (receiving opens a FIFO lot at the line's cost) | **Live** |

### manufacturing (`lib/modules/manufacturing`)
| Resource | Depth |
|---|---|
| Assembly (nested inputs→outputs; completion consumes inputs FIFO and produces costed output lots), CostType, Cost | **Live** - transactional, idempotent posting to the ledger |
| Production scheduling (scheduled window + operator), Input reservation (soft holds; available = on-hand − reserved) | **Live** |

### compliance (`lib/modules/compliance`)
| Resource | Depth |
|---|---|
| License (company-linked, validity + expiry checks), LicenseType, TestResult / COA (package-linked, structured potency) | **Live** |
| Metrc (track-and-trace) | **Mocked-behind-a-seam** - linkage fields + a read-only Metrc view over an API-accurate mock provider; live two-way sync is deliberately not stubbed as real |

### cultivation (`lib/modules/cultivation`)
| Resource | Depth |
|---|---|
| PlantBatch, Plant (phase lifecycle), Harvest (wet/dry weight), PlantEvent (Metrc-style audit timeline) | **Live** - core grow lifecycle |

### logistics (`lib/modules/logistics`)
| Resource | Depth |
|---|---|
| Delivery (DRAFT→ASSIGNED→OUT_FOR_DELIVERY→DELIVERED, drives order fulfillment forward), DeliveryRoute (driver's daily manifest) | **Live** - dispatch lifecycle; no live GPS tracking |
| Driver, Vehicle | **CRUD** |

### reports (`lib/modules/reports`)
| Resource | Depth |
|---|---|
| Insights report registry (24 reports, all real - incl. the 3 cultivation reports), Artifact (durable materialized reports) | **Live** |

### platform (`lib/modules/platform`)
| Resource | Depth |
|---|---|
| API token, Webhook, Audit log, User/Org (better-auth), Task (priority/due; board + calendar UI) | **Live** |
| IntegrationConnection + SyncEvent (per-provider status + live sync feed) | **Live** - over mock provider adapters |
| CustomField (definitions), FileAttachment | **CRUD** |

### notifications (`lib/modules/notifications`)
| Resource | Depth |
|---|---|
| Notification (the feed behind the bell) | **Live** |

## Why depth is still marked

Most of the domain is now **Live** - the transactional inventory/manufacturing core, sales and purchasing, deliveries, cultivation, compliance validation, tasks, and reporting all do real work end to end. What stays honestly short of "live" is the last mile that needs an upstream external system: two-way **Metrc/BioTrack** track-and-trace and **QuickBooks/LeafLink** sync run against **API-accurate mock providers behind a real seam** (`lib/integrations/`), never faked as live. So the **structure** is the whole ERP (every resource is a real, queryable, org-scoped table with a module and, where it's a straightforward record, a REST surface), and the residual **behavior depth** is labeled. Promoting a resource is the same recipe as everywhere else: add or swap the side-effecting service function and wrap it on the faces - the tables, boundaries, and audit trail are already in place. See [Modular architecture](/docs/modular-architecture) for that recipe, [Distru fidelity](/docs/fidelity) for the honest gap list, and [API reference](/docs/api-reference) for the live endpoints.
