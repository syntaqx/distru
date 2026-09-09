import { authenticate, dateRange, requireScope } from "@/lib/public-api";
import { listPurchaseOrders, type PurchaseOrderStatus } from "@/lib/modules/purchasing";
import { datetime, num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "po_number", label: "PO Number" },
  { key: "vendor", label: "Vendor" },
  { key: "status", label: "Status" },
  { key: "order_datetime", label: "Order Date" },
  { key: "item_count", label: "Items" },
  { key: "total", label: "Total" },
];

/** One row per purchase order: vendor, status, and total cost. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as PurchaseOrderStatus | null;
  const { from, to } = dateRange(req, "order_datetime");
  const { items } = await listPurchaseOrders(auth.ctx, {
    status: status ?? undefined,
    updatedFrom: from,
    updatedTo: to,
    limit: 200,
  });
  return Response.json(
    reportEnvelope(
      COLUMNS,
      items.map((i) => ({
        po_number: i.purchaseOrder.poNumber,
        vendor: i.vendor?.name ?? null,
        status: i.purchaseOrder.status,
        order_datetime: datetime(i.purchaseOrder.orderDate),
        item_count: String(i.itemCount),
        total: num(i.total),
      })),
    ),
  );
}
