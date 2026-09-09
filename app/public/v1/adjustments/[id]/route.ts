import { authenticate, distruError, requireScope } from "@/lib/public-api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryLedger, locations } from "@/db/schema";
import { datetime, num } from "@/lib/modules/shared";

/** Get one inventory adjustment (a movement in the append-only ledger). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const { id } = await params;
  const [row] = await db
    .select({
      id: inventoryLedger.id,
      productId: inventoryLedger.productId,
      location: locations.name,
      quantityDelta: inventoryLedger.quantityDelta,
      reason: inventoryLedger.reason,
      insertedDatetime: inventoryLedger.createdAt,
    })
    .from(inventoryLedger)
    .leftJoin(locations, eq(inventoryLedger.locationId, locations.id))
    .where(and(eq(inventoryLedger.organizationId, auth.ctx.orgId), eq(inventoryLedger.id, id)))
    .limit(1);

  if (!row) return distruError(404, "Adjustment not found", ["id"], "path");

  return Response.json({
    data: {
      id: row.id,
      product_id: row.productId,
      location: row.location,
      quantity_delta: num(row.quantityDelta),
      reason: row.reason,
      inserted_datetime: datetime(row.insertedDatetime),
    },
  });
}
