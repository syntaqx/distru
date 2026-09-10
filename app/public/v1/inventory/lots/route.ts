import {
  authenticate,
  listEnvelope,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listLots, lotToApi } from "@/lib/modules/inventory";

/**
 * GET /public/v1/inventory/lots - the FIFO cost layers behind on-hand. Filter
 * with ?product_id=, ?location_id=, and ?open_only=false to include drawn-down
 * layers (defaults to open layers only).
 */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const offset = pageOffset(req);
  const { items, total } = await listLots(auth.ctx, {
    productId: url.searchParams.get("product_id") ?? undefined,
    locationId: url.searchParams.get("location_id") ?? undefined,
    openOnly: url.searchParams.get("open_only") !== "false",
    offset,
  });
  return listEnvelope(req, items.map(lotToApi), offset, total);
}
