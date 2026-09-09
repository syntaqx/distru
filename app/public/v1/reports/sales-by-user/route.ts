import { authenticate, requireScope } from "@/lib/public-api";
import { salesSummary } from "@/lib/modules/sales";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "user", label: "User" },
  { key: "order_count", label: "Orders" },
  { key: "units_sold", label: "Units Sold" },
  { key: "revenue", label: "Revenue" },
];

/**
 * Booked sales grouped by user. Orders in this clone carry no salesperson
 * attribution, so all booked sales roll up under a single "Unassigned" user.
 */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const summary = await salesSummary(auth.ctx);
  const rows = summary.orderCount
    ? [
        {
          user: "Unassigned",
          order_count: String(summary.orderCount),
          units_sold: num(summary.unitsSold),
          revenue: num(summary.revenue),
        },
      ]
    : [];
  return Response.json(reportEnvelope(COLUMNS, rows));
}
