import { authenticate, requireScope } from "@/lib/public-api";
import { topProducts } from "@/lib/modules/sales";
import { listProducts } from "@/lib/modules/catalog";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "quantity_sold", label: "Quantity Sold" },
  { key: "unit_cost", label: "Unit Cost" },
  { key: "total_cogs", label: "Total COGS" },
];

/**
 * Cost of goods sold per product = units sold x unit cost. This clone has no
 * dedicated product cost column, so the product's unit_price is used as the
 * cost basis.
 */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "manufacturing:read");
  if (scopeErr) return scopeErr;

  const [sold, products] = await Promise.all([
    topProducts(auth.ctx, { limit: 100, by: "quantity" }),
    listProducts(auth.ctx, { limit: 200 }),
  ]);
  const costBySku = new Map(
    products.items.map((p) => [p.product.sku, Number(p.product.unitPrice ?? 0)]),
  );
  return Response.json(
    reportEnvelope(
      COLUMNS,
      sold.map((r) => {
        const unitCost = costBySku.get(r.sku) ?? 0;
        return {
          sku: r.sku,
          product: r.name,
          quantity_sold: num(r.quantitySold),
          unit_cost: num(unitCost),
          total_cogs: num(r.quantitySold * unitCost),
        };
      }),
    ),
  );
}
