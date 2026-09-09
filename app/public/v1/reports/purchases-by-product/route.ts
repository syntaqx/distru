import { authenticate, requireScope } from "@/lib/public-api";
import { getPurchaseOrder, listPurchaseOrders } from "@/lib/modules/purchasing";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "quantity_purchased", label: "Quantity Purchased" },
  { key: "po_count", label: "Purchase Orders" },
  { key: "total_cost", label: "Total Cost" },
];

type Bucket = { name: string; quantity: number; cost: number; pos: Set<string> };

/** Purchased quantity and cost grouped by product SKU, across purchase orders. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const { items } = await listPurchaseOrders(auth.ctx, { limit: 50 });
  const buckets = new Map<string, Bucket>();
  for (const listed of items) {
    const po = await getPurchaseOrder(auth.ctx, listed.purchaseOrder.id);
    if (!po) continue;
    for (const item of po.items) {
      const key = item.sku ?? item.name;
      const bucket = buckets.get(key) ?? {
        name: item.name,
        quantity: 0,
        cost: 0,
        pos: new Set<string>(),
      };
      bucket.quantity += Number(item.quantity);
      bucket.cost += Number(item.quantity) * Number(item.unitCost);
      bucket.pos.add(po.purchaseOrder.id);
      buckets.set(key, bucket);
    }
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([sku, b]) => ({
      sku,
      product: b.name,
      quantity_purchased: num(b.quantity),
      po_count: String(b.pos.size),
      total_cost: num(b.cost),
    }));
  return Response.json(reportEnvelope(COLUMNS, rows));
}
