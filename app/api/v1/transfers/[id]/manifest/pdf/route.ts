import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { getTransfer } from "@/lib/modules/inventory";
import { listProducts } from "@/lib/modules/catalog";
import { simplePdf, pdfResponse } from "@/lib/pdf";

/**
 * GET /api/v1/transfers/{id}/manifest/pdf — a Metrc-style transfer manifest
 * for a stock transfer: the shipping/receiving locations plus the line items.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const transfer = await getTransfer(auth.ctx, id);
  if (!transfer) return distruError(404, "Transfer not found", ["id"], "path");

  const { items } = await listProducts(auth.ctx, { limit: 500 });
  const nameOf = (pid: string | null) =>
    items.find((p) => p.product.id === pid)?.product.name ?? "-";

  const lines = [
    `Manifest: ${transfer.transferNumber}`,
    `Status: ${transfer.status}`,
    "",
    "Line items:",
    ...transfer.lines.map(
      (l) => `  ${l.quantity} × ${nameOf(l.productId)}` + (l.movedCost ? ` (cost $${Number(l.movedCost).toFixed(2)})` : ""),
    ),
  ];
  return pdfResponse(
    simplePdf(`Transfer Manifest ${transfer.transferNumber}`, lines),
    `manifest-${transfer.transferNumber}`,
  );
}
