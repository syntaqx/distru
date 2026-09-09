import { authenticate, requireScope } from "@/lib/public-api";
import { listProducts } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "category", label: "Category" },
  { key: "product_count", label: "Products" },
  { key: "on_hand", label: "On Hand" },
  { key: "total_value", label: "Total Value" },
];

type Bucket = { count: number; onHand: number; value: number };

/** Inventory assets rolled up by product category: on-hand and total value. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const [products, onHand] = await Promise.all([
    listProducts(auth.ctx, { limit: 200 }),
    onHandByProduct(auth.ctx),
  ]);
  const buckets = new Map<string, Bucket>();
  for (const p of products.items) {
    const category = p.category?.name ?? "Uncategorized";
    const qty = onHand.get(p.product.id) ?? 0;
    const value = qty * Number(p.product.unitPrice ?? 0);
    const bucket = buckets.get(category) ?? { count: 0, onHand: 0, value: 0 };
    bucket.count += 1;
    bucket.onHand += qty;
    bucket.value += value;
    buckets.set(category, bucket);
  }
  const rows = [...buckets.entries()].map(([category, b]) => ({
    category,
    product_count: String(b.count),
    on_hand: num(b.onHand),
    total_value: num(b.value),
  }));
  return Response.json(reportEnvelope(COLUMNS, rows));
}
