import { authenticate, dateRange, requireScope } from "@/lib/public-api";
import { listOrders, type OrderStatus } from "@/lib/modules/sales";
import { datetime, num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "order_number", label: "Order Number" },
  { key: "company", label: "Company" },
  { key: "status", label: "Status" },
  { key: "order_datetime", label: "Order Date" },
  { key: "item_count", label: "Items" },
  { key: "total", label: "Total" },
];

/** One row per sales order: status, customer, and order total. */
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
    limit: 200,
  });
  return Response.json(
    reportEnvelope(
      COLUMNS,
      items.map((i) => ({
        order_number: i.order.orderNumber,
        company: i.customer?.name ?? null,
        status: i.order.status,
        order_datetime: datetime(i.order.orderDate),
        item_count: String(i.itemCount),
        total: num(i.total),
      })),
    ),
  );
}
