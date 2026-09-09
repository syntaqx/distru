import { authenticate, dateRange, requireScope } from "@/lib/public-api";
import { getOrder, listOrders, lineTotal, type OrderStatus } from "@/lib/modules/sales";
import { datetime, num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "order_number", label: "Order Number" },
  { key: "company", label: "Company" },
  { key: "order_datetime", label: "Order Date" },
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "quantity", label: "Quantity" },
  { key: "price", label: "Unit Price" },
  { key: "line_total", label: "Line Total" },
];

/** One row per order line item, flattened across recent sales orders. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") as OrderStatus | null;
  const { from, to } = dateRange(req, "order_datetime");
  const { items } = await listOrders(auth.ctx, {
    status: status ?? undefined,
    updatedFrom: from,
    updatedTo: to,
    limit: 50,
  });

  const rows = [];
  for (const listed of items) {
    const order = await getOrder(auth.ctx, listed.order.id);
    if (!order) continue;
    for (const item of order.items) {
      rows.push({
        order_number: order.order.orderNumber,
        company: order.customer?.name ?? null,
        order_datetime: datetime(order.order.orderDate),
        sku: item.sku ?? null,
        product: item.name,
        quantity: num(item.quantity),
        price: num(item.unitPrice),
        line_total: num(lineTotal(item)),
      });
    }
  }
  return Response.json(reportEnvelope(COLUMNS, rows));
}
