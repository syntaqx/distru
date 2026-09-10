import {
  authenticate,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listProducts } from "@/lib/modules/catalog";
import { inventoryValueByProduct, onHandByProduct } from "@/lib/modules/inventory";
import { reservedByProduct } from "@/lib/modules/sales";
import { num } from "@/lib/modules/shared";

/**
 * GET /api/v1/inventory - on-hand snapshot per product with Distru's
 * availability split: `active` (physical on-hand), `reserved` (soft-held on
 * PENDING orders), `available` (active - reserved), plus cost at FIFO valuation.
 */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const offset = pageOffset(req);
  const [{ items, total }, active, reserved, value] = await Promise.all([
    listProducts(auth.ctx, { status: "ACTIVE", limit: PAGE_SIZE, offset }),
    onHandByProduct(auth.ctx),
    reservedByProduct(auth.ctx),
    inventoryValueByProduct(auth.ctx),
  ]);

  const data = items.map((item) => {
    const id = item.product.id;
    const act = active.get(id) ?? 0;
    const res = reserved.get(id) ?? 0;
    const val = value.get(id);
    const perUnit = val && val.qty > 0 ? val.value / val.qty : 0;
    return {
      product_id: id,
      sku: item.product.sku,
      name: item.product.name,
      active: num(act),
      reserved: num(res),
      available: num(act - res),
      quantity: num(act),
      cost_per_unit_actual: num(perUnit),
      total_cost_actual: num(val?.value ?? 0),
    };
  });

  return listEnvelope(req, data, offset, total);
}
