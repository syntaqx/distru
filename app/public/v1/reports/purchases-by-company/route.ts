import { authenticate, requireScope } from "@/lib/public-api";
import { listPurchaseOrders } from "@/lib/modules/purchasing";
import { num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "vendor", label: "Vendor" },
  { key: "po_count", label: "Purchase Orders" },
  { key: "total", label: "Total Purchased" },
];

type Bucket = { count: number; total: number };

/** Purchase spend grouped by vendor company. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "companies:read");
  if (scopeErr) return scopeErr;

  const { items } = await listPurchaseOrders(auth.ctx, { limit: 200 });
  const buckets = new Map<string, Bucket>();
  for (const i of items) {
    const vendor = i.vendor?.name ?? "(no vendor)";
    const bucket = buckets.get(vendor) ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += i.total;
    buckets.set(vendor, bucket);
  }
  const rows = [...buckets.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([vendor, b]) => ({
      vendor,
      po_count: String(b.count),
      total: num(b.total),
    }));
  return Response.json(reportEnvelope(COLUMNS, rows));
}
