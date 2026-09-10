import {
  authenticate,
  dateRange,
  distruError,
  listEnvelope,
  PAGE_SIZE,
  pageOffset,
  requireScope,
} from "@/lib/public-api";
import {
  deliveryToApi,
  getDeliveryEnriched,
  listDeliveries,
  upsertDelivery,
  type DeliveryStatus,
} from "@/lib/modules/logistics";
import { getOrderByNumber } from "@/lib/modules/sales";
import { emitEvent } from "@/lib/modules/platform";

const STATUSES: DeliveryStatus[] = [
  "DRAFT",
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
];

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:read");
  if (scopeErr) return scopeErr;

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get("status")?.toUpperCase();
  const status = statusRaw && STATUSES.includes(statusRaw as DeliveryStatus)
    ? (statusRaw as DeliveryStatus)
    : undefined;
  const driverId = url.searchParams.get("driver_id") ?? undefined;
  const { from, to } = dateRange(req, "scheduled_datetime");
  const offset = pageOffset(req);

  const { items, total } = await listDeliveries(auth.ctx, {
    status,
    driverId,
    scheduledFrom: from,
    scheduledTo: to,
    limit: PAGE_SIZE,
    offset,
  });
  return listEnvelope(req, items.map(deliveryToApi), offset, total);
}

type DeliveryBody = {
  id?: string;
  order_id?: string;
  order_number?: string;
  driver_id?: string | null;
  vehicle_id?: string | null;
  route_id?: string | null;
  status?: string;
  sequence?: number | null;
  scheduled_datetime?: string | null;
  delivered_datetime?: string | null;
  notes?: string | null;
  address?: Record<string, string | null> | null;
};

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Sparse upsert, Distru-style: omit id to create, include id to update. */
export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "logistics:write");
  if (scopeErr) return scopeErr;
  const body = (await req.json().catch(() => null)) as DeliveryBody | null;
  if (!body) return distruError(400, "Invalid JSON body", [], "body");

  const status =
    body.status && STATUSES.includes(body.status.toUpperCase() as DeliveryStatus)
      ? (body.status.toUpperCase() as DeliveryStatus)
      : undefined;

  try {
    // Resolve order by number when no id was given (create path).
    let orderId = body.order_id ?? undefined;
    if (!body.id && !orderId && body.order_number) {
      const order = await getOrderByNumber(auth.ctx, body.order_number);
      if (!order) return distruError(404, "Order not found", ["order_number"], "body");
      orderId = order.order.id;
    }

    const { row, created } = await upsertDelivery(auth.ctx, {
      id: body.id,
      orderId,
      routeId: body.route_id,
      driverId: body.driver_id,
      vehicleId: body.vehicle_id,
      status,
      sequence: body.sequence,
      scheduledAt: parseDate(body.scheduled_datetime),
      deliveredAt: parseDate(body.delivered_datetime),
      notes: body.notes,
      address: body.address ?? undefined,
    });

    const enriched = await getDeliveryEnriched(auth.ctx, row.id);
    const api = deliveryToApi(enriched!);
    await emitEvent(auth.ctx, created ? "delivery.created" : "delivery.updated", api, { id: row.id });
    return Response.json({ data: api }, { status: created ? 201 : 200 });
  } catch (err) {
    return distruError(400, err instanceof Error ? err.message : "Delivery upsert failed", [], "body");
  }
}
