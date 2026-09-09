import { authenticate, requireScope } from "@/lib/public-api";
import { topCustomers } from "@/lib/modules/sales";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "company", label: "Company" },
  { key: "order_count", label: "Orders" },
  { key: "revenue", label: "Revenue" },
];

/** Booked revenue grouped by customer company. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;

  const rows = await topCustomers(auth.ctx, { limit: 100 });
  return Response.json(
    reportEnvelope(
      COLUMNS,
      rows.map((r) => ({
        company: r.name,
        order_count: String(r.orderCount),
        revenue: num(r.revenue),
      })),
    ),
  );
}
