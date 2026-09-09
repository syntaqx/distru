import {
  authenticate,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { getDefaultLocation, listProducts } from "@/lib/modules/catalog";
import { getOnHand } from "@/lib/modules/inventory";
import { num } from "@/lib/modules/shared";

/** On-hand snapshot across active products at the org's default location. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const offset = pageOffset(req);
  const location = await getDefaultLocation(auth.ctx);
  const { items, total } = await listProducts(auth.ctx, {
    status: "ACTIVE",
    limit: PAGE_SIZE,
    offset,
  });

  const data = await Promise.all(
    items.map(async (item) => ({
      product_id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      location: location.name,
      quantity: num(await getOnHand(auth.ctx, item.product.id, location.id)),
    })),
  );

  return listEnvelope(req, data, offset, total);
}
