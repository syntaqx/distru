import { authenticate, requireScope } from "@/lib/public-api";
import { topProducts } from "@/lib/modules/sales";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "quantity_sold", label: "Quantity Sold" },
  { key: "order_count", label: "Orders" },
  { key: "revenue", label: "Revenue" },
];

/** Booked revenue and units grouped by product SKU. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;

  const rows = await topProducts(auth.ctx, { limit: 100 });
  return Response.json(
    reportEnvelope(
      COLUMNS,
      rows.map((r) => ({
        sku: r.sku,
        product: r.name,
        quantity_sold: num(r.quantitySold),
        order_count: String(r.orderCount),
        revenue: num(r.revenue),
      })),
    ),
  );
}
