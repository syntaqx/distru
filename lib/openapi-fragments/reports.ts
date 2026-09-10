/** OpenAPI fragment: reports endpoints. Populated by its subsystem. */

/** A single report definition: which query params it accepts and how to describe it. */
type ReportDef = {
  name: string;
  summary: string;
  description: string;
  /** Extra query parameters beyond the shared status/date-range pair. */
  dateParam?: string;
  hasStatus?: boolean;
};

const REPORTS: ReportDef[] = [
  {
    name: "sales-by-company",
    summary: "Sales by company",
    description: "Booked revenue and order counts grouped by customer company.",
    dateParam: "order_datetime",
  },
  {
    name: "sales-by-product",
    summary: "Sales by product",
    description: "Booked revenue and units sold grouped by product SKU.",
    dateParam: "order_datetime",
  },
  {
    name: "sales-by-user",
    summary: "Sales by user",
    description:
      "Booked sales grouped by user. Orders carry no salesperson attribution in this clone, so sales roll up under a single Unassigned user.",
    dateParam: "order_datetime",
  },
  {
    name: "sales-order-history",
    summary: "Sales order history",
    description: "One row per sales order: status, customer, and order total.",
    hasStatus: true,
    dateParam: "order_datetime",
  },
  {
    name: "sales-order-item-history",
    summary: "Sales order item history",
    description: "One row per order line item, flattened across recent sales orders.",
    hasStatus: true,
    dateParam: "order_datetime",
  },
  {
    name: "sales-order-tax",
    summary: "Sales order tax",
    description: "Tax collected per sales order, broken out from the order's charge lines.",
    hasStatus: true,
    dateParam: "order_datetime",
  },
  {
    name: "order-fulfillment",
    summary: "Order fulfillment",
    description: "Order counts by fulfillment status - the pipeline view.",
  },
  {
    name: "invoice-history",
    summary: "Invoice history",
    description: "One row per invoice: totals, payment status, and outstanding balance.",
    hasStatus: true,
    dateParam: "invoice_datetime",
  },
  {
    name: "sales-matrix",
    summary: "Sales matrix (units by month)",
    description:
      "Units sold per product across the last six calendar months, one column per month plus a row total - the sales matrix.",
  },
  {
    name: "sales-by-month",
    summary: "Sales by month",
    description: "Booked revenue, units, and order counts grouped by calendar month - the sales trend.",
    dateParam: "order_datetime",
  },
  {
    name: "margin-by-product",
    summary: "Margin by product",
    description:
      "Gross margin per product across booked orders: revenue minus real COGS (order_items.cogs), with margin %.",
    dateParam: "order_datetime",
  },
  {
    name: "ar-aging",
    summary: "AR aging",
    description:
      "Open invoice balances bucketed by age (0-30 / 31-60 / 61-90 / 90+ days) and rolled up per customer company.",
  },
  {
    name: "payments-received",
    summary: "Payments received",
    description: "Payments received grouped by payment method, with count and total.",
    dateParam: "payment_datetime",
  },
  {
    name: "low-stock",
    summary: "Low stock / reorder",
    description:
      "Active, inventory-tracked products at or below the reorder threshold, with on-hand and suggested reorder quantity.",
  },
  {
    name: "cogs",
    summary: "Cost of goods sold",
    description:
      "Cost of goods sold per product = units sold x unit cost. The product's unit price is used as the cost basis.",
  },
  {
    name: "inventory-valuation",
    summary: "Inventory valuation",
    description: "Per-product inventory valuation: on-hand quantity x unit price.",
  },
  {
    name: "inventory-assets",
    summary: "Inventory assets",
    description: "Inventory assets rolled up by product category: on-hand and total value.",
  },
  {
    name: "inventory-transaction-history",
    summary: "Inventory transaction history",
    description: "Inventory ledger movements, newest first - every posted stock change.",
  },
  {
    name: "purchase-order-history",
    summary: "Purchase order history",
    description: "One row per purchase order: vendor, status, and total cost.",
    hasStatus: true,
    dateParam: "order_datetime",
  },
  {
    name: "purchases-by-company",
    summary: "Purchases by company",
    description: "Purchase spend grouped by vendor company.",
  },
  {
    name: "purchases-by-product",
    summary: "Purchases by product",
    description: "Purchased quantity and cost grouped by product SKU, across purchase orders.",
  },
  {
    name: "cultivation-transaction-history",
    summary: "Cultivation transaction history",
    description: "Cultivation ledger movements. This clone has no cultivation data (empty report).",
  },
  {
    name: "harvest-outputs",
    summary: "Harvest outputs",
    description: "Harvest yields and outputs. This clone has no cultivation data (empty report).",
  },
  {
    name: "plant-lifecycle",
    summary: "Plant lifecycle",
    description: "Plant lifecycle stage transitions. This clone has no cultivation data (empty report).",
  },
];

function operation(def: ReportDef) {
  const parameters: Record<string, unknown>[] = [];
  if (def.hasStatus) {
    parameters.push({ name: "status", in: "query", schema: { type: "string" } });
  }
  if (def.dateParam) {
    parameters.push({
      name: def.dateParam,
      in: "query",
      schema: { type: "string" },
      description: "Comma-delimited inclusive date range.",
    });
  }
  return {
    get: {
      tags: ["Reports"],
      summary: def.summary,
      description: def.description,
      parameters,
      responses: {
        "200": {
          description: "The report.",
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Report" } },
          },
        },
        "401": { $ref: "#/components/responses/Unauthorized" },
      },
    },
  };
}

export const paths: Record<string, unknown> = Object.fromEntries(
  REPORTS.map((def) => [`/public/v1/reports/${def.name}`, operation(def)]),
);

export const schemas: Record<string, unknown> = {
  Report: {
    type: "object",
    properties: {
      data: { type: "array", items: { type: "object" } },
      meta: {
        type: "object",
        properties: {
          columns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                label: { type: "string" },
              },
            },
          },
          date_range: { type: "string", nullable: true },
          generated_datetime: { type: "string" },
        },
      },
    },
  },
};
