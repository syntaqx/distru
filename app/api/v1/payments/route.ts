import {
  authenticate,
  dateRange,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import { listPayments, paymentToApi } from "@/lib/modules/sales";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "invoices:read");
  if (scopeErr) return scopeErr;
  // dateRange is accepted for parity but payments filter primarily by invoice.
  void dateRange(req, "updated_datetime");
  const offset = pageOffset(req);
  const { items, total } = await listPayments(auth.ctx, { limit: PAGE_SIZE, offset });
  return listEnvelope(req, items.map(paymentToApi), offset, total);
}
