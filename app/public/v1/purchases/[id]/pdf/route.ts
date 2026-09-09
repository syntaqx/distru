import { authenticate, requireScope } from "@/lib/public-api";
import { getPurchaseOrder } from "@/lib/modules/purchasing";
import { simplePdf, pdfResponse } from "@/lib/pdf";

/** GET /public/v1/purchases/{id}/pdf — a printable purchase-order summary. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "orders:read");
  if (scopeErr) return scopeErr;
  const { id } = await params;
  const po = await getPurchaseOrder(auth.ctx, id);
  if (!po) {
    return pdfResponse(
      simplePdf(`Purchase ${id}`, ["No data on file."]),
      `purchase-${id}`,
    );
  }

  const r = po.purchaseOrder;
  const date = r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : "-";
  const lines = [
    `Vendor: ${po.vendor?.name ?? "-"}`,
    `Status: ${r.status}`,
    `Date: ${date}`,
    "",
    "Items:",
    ...po.items.map(
      (i) => `  ${i.name} x${Number(i.quantity)} @ $${Number(i.unitCost).toFixed(2)}`,
    ),
    "",
    `Total: $${Number(po.total).toFixed(2)}`,
  ];
  return pdfResponse(simplePdf(`Purchase ${r.poNumber}`, lines), `purchase-${r.poNumber}`);
}
