import type { ServiceCtx } from "@/lib/modules/shared";
import { productSkuInfoMap } from "@/lib/modules/catalog";
import { addOrderItem, findOrCreateDraftOrder } from "@/lib/modules/sales";
import { findOrCreateCustomer } from "@/lib/modules/catalog";
import type { ImportTarget } from "../target";
import type { CanonicalField, RowError } from "../types";

/**
 * A sales-order / line-item import: each row is one line on an order identified
 * by an order number. Rows are grouped into orders and land as DRAFTs to review
 * (importing history should never silently ship inventory). Proves the framework
 * handles a parent/child entity in a single file - no pipeline changes.
 */
type Prep = {
  skuInfo: Map<string, { id: string; name: string; unitPrice: string | null }>;
  customerCache: Map<string, string>;
  orderCache: Map<string, string>;
};

type OrderLineValue = {
  orderNumber: string;
  customer: string | null;
  productId: string;
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string | null;
};

const FIELDS: CanonicalField[] = [
  {
    key: "order_number",
    label: "Order Number",
    type: "string",
    required: true,
    aliases: ["order number", "order #", "order id", "order", "so #", "so number", "sales order"],
  },
  {
    key: "customer",
    label: "Customer",
    type: "string",
    required: false,
    aliases: ["customer", "buyer", "account", "sold to", "client", "company"],
  },
  {
    key: "sku",
    label: "SKU",
    type: "string",
    required: true,
    aliases: ["sku", "item #", "item number", "product code", "code", "upc", "product"],
  },
  {
    key: "quantity",
    label: "Quantity",
    type: "number",
    required: true,
    aliases: ["quantity", "qty", "units", "count", "amount"],
  },
  {
    key: "unit_price",
    label: "Unit Price",
    type: "number",
    required: false,
    aliases: ["price", "unit price", "unit cost", "rate", "each"],
  },
];

function parseNum(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const cleaned = String(v).replace(/[$,\s]/g, "").replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || Number.isNaN(Number(cleaned))) return null;
  return String(Number(cleaned));
}

export const ordersTarget: ImportTarget<Prep, OrderLineValue> = {
  key: "orders",
  label: "Sales Orders",
  description:
    "Import sales orders as line items grouped by order number. Rows for unknown " +
    "SKUs are reported as errors; imported orders land as drafts to review.",
  fields: FIELDS,
  async prepare(ctx: ServiceCtx) {
    return {
      skuInfo: await productSkuInfoMap(ctx),
      customerCache: new Map(),
      orderCache: new Map(),
    };
  },
  validateRow(mapped, prep) {
    const errors: RowError[] = [];
    const orderNumber = mapped.order_number ? String(mapped.order_number).trim() : "";
    if (!orderNumber)
      errors.push({ field: "order_number", code: "required", message: "Order Number is required" });
    const sku = mapped.sku ? String(mapped.sku).trim() : "";
    if (!sku) errors.push({ field: "sku", code: "required", message: "SKU is required" });
    const info = sku ? prep.skuInfo.get(sku.toLowerCase()) : undefined;
    if (sku && !info)
      errors.push({ field: "sku", code: "unknown_sku", message: `No product found with SKU "${sku}"` });
    const quantity = parseNum(mapped.quantity);
    if (quantity === null)
      errors.push({ field: "quantity", code: "not_a_number", message: `Quantity "${mapped.quantity}" is not a number` });
    else if (Number(quantity) <= 0)
      errors.push({ field: "quantity", code: "invalid", message: "Quantity must be greater than 0" });
    if (errors.length > 0) return { ok: false, errors };
    const customer = mapped.customer ? String(mapped.customer).trim() : "";
    return {
      ok: true,
      value: {
        orderNumber,
        customer: customer || null,
        productId: info!.id,
        sku,
        name: info!.name,
        quantity: quantity!,
        unitPrice: parseNum(mapped.unit_price) ?? info!.unitPrice,
      },
    };
  },
  async commitRows(rows, ctx, prep) {
    const out: { productId?: string | null }[] = [];
    for (const { value } of rows) {
      let customerId: string | null = null;
      if (value.customer) {
        const key = value.customer.toLowerCase();
        customerId = prep.customerCache.get(key) ?? null;
        if (!customerId) {
          customerId = (await findOrCreateCustomer(ctx, value.customer)).id;
          prep.customerCache.set(key, customerId);
        }
      }
      let orderId = prep.orderCache.get(value.orderNumber);
      if (!orderId) {
        const order = await findOrCreateDraftOrder(ctx, {
          orderNumber: value.orderNumber,
          customerId,
        });
        orderId = order.id;
        prep.orderCache.set(value.orderNumber, orderId);
      }
      await addOrderItem(ctx, orderId, {
        productId: value.productId,
        sku: value.sku,
        name: value.name,
        quantity: value.quantity,
        unitPrice: value.unitPrice,
      });
      out.push({ productId: value.productId });
    }
    return out;
  },
};
