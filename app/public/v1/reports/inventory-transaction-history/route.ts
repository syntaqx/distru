import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryLedger, locations, products } from "@/db/schema";
import { authenticate, requireScope } from "@/lib/public-api";
import { datetime, num } from "@/lib/modules/shared";
import { reportEnvelope } from "../_report";

const COLUMNS = [
  { key: "datetime", label: "Date" },
  { key: "sku", label: "SKU" },
  { key: "product", label: "Product" },
  { key: "location", label: "Location" },
  { key: "quantity_delta", label: "Quantity Change" },
  { key: "reason", label: "Reason" },
  { key: "actor", label: "Actor" },
];

/** Inventory ledger movements, newest first - every posted stock change. */
export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const scopeErr = requireScope(auth, "inventory:read");
  if (scopeErr) return scopeErr;

  const rows = await db
    .select({
      createdAt: inventoryLedger.createdAt,
      quantityDelta: inventoryLedger.quantityDelta,
      reason: inventoryLedger.reason,
      actor: inventoryLedger.actor,
      sku: products.sku,
      productName: products.name,
      locationName: locations.name,
    })
    .from(inventoryLedger)
    .leftJoin(products, eq(inventoryLedger.productId, products.id))
    .leftJoin(locations, eq(inventoryLedger.locationId, locations.id))
    .where(and(eq(inventoryLedger.organizationId, auth.ctx.orgId)))
    .orderBy(desc(inventoryLedger.createdAt))
    .limit(200);

  return Response.json(
    reportEnvelope(
      COLUMNS,
      rows.map((r) => ({
        datetime: datetime(r.createdAt),
        sku: r.sku ?? null,
        product: r.productName ?? null,
        location: r.locationName ?? null,
        quantity_delta: num(r.quantityDelta),
        reason: r.reason,
        actor: r.actor,
      })),
    ),
  );
}
