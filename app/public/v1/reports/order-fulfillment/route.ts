import { authenticate, requireScope } from "@/lib/public-api";
import { listOrders, ORDER_LIFECYCLE, type OrderStatus } from "@/lib/modules/sales";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "status", label: "Status" },
  { key: "order_count", label: "Orders" },
];

/** Order counts by fulfillment status - the pipeline view. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const statuses: OrderStatus[] = [...ORDER_LIFECYCLE, "CANCELED"];
  const counts = await Promise.all(
    statuses.map((status) => listOrders(auth.ctx, { status, limit: 1 })),
  );
  const rows = statuses.map((status, i) => ({
    status,
    order_count: String(counts[i].total),
  }));
  return Response.json(reportEnvelope(COLUMNS, rows));
}
