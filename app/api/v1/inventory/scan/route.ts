import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getOnHand, packageToApi, scanCode } from "@/lib/modules/inventory";
import { num } from "@/lib/modules/shared";

/**
 * GET /api/v1/inventory/scan?code=<code> — resolve a scanned code (package
 * tag, Metrc tag, barcode, serial, or product SKU/barcode) to what it is, with
 * on-hand. Powers a warehouse scan-lookup.
 */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const code = new URL(req.url).searchParams.get("code");
  if (!code) return distruError(400, "code query parameter is required", ["code"], "query");

  const found = await scanCode(auth.ctx, code);
  if (!found) return Response.json({ data: { kind: "none", match: null } });

  if (found.kind === "package") {
    return Response.json({ data: { kind: "package", package: packageToApi(found.package) } });
  }
  const onHand = await getOnHand(auth.ctx, found.product.id);
  return Response.json({
    data: {
      kind: "product",
      product: {
        id: found.product.id,
        sku: found.product.sku,
        name: found.product.name,
        on_hand: num(onHand),
      },
    },
  });
}
