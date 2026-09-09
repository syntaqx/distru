import { authenticate, requireScope } from "@/lib/public-api";
import { listProducts } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "on_hand", label: "On Hand" },
  { key: "unit_price", label: "Unit Price" },
  { key: "total_value", label: "Total Value" },
];

/** Per-product inventory valuation: on-hand quantity x unit price. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const [products, onHand] = await Promise.all([
    listProducts(auth.ctx, { limit: 200 }),
    onHandByProduct(auth.ctx),
  ]);
  return Response.json(
    reportEnvelope(
      COLUMNS,
      products.items.map((p) => {
        const qty = onHand.get(p.product.id) ?? 0;
        const price = Number(p.product.unitPrice ?? 0);
        return {
          sku: p.product.sku,
          product: p.product.name,
          on_hand: num(qty),
          unit_price: num(price),
          total_value: num(qty * price),
        };
      }),
    ),
  );
}
