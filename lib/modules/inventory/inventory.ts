import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryLedger } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { recordAudit } from "../shared";

/** Current on-hand for a product (optionally at one location) = SUM(deltas). */
export async function getOnHand(
  ctx: ServiceCtx,
  productId: string,
  locationId?: string,
) {
  const filters = [
    eq(inventoryLedger.organizationId, ctx.orgId),
    eq(inventoryLedger.productId, productId),
  ];
  if (locationId) filters.push(eq(inventoryLedger.locationId, locationId));
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${inventoryLedger.quantityDelta}), 0)` })
    .from(inventoryLedger)
    .where(and(...filters));
  return Number(row?.total ?? 0);
}

/** Map of productId → total on-hand across all locations for the org. */
export async function onHandByProduct(ctx: ServiceCtx) {
  const rows = await db
    .select({
      productId: inventoryLedger.productId,
      total: sql<string>`coalesce(sum(${inventoryLedger.quantityDelta}), 0)`,
    })
    .from(inventoryLedger)
    .where(eq(inventoryLedger.organizationId, ctx.orgId))
    .groupBy(inventoryLedger.productId);
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.productId, Number(r.total));
  return map;
}

/** Post an inventory movement. Returns the new on-hand at that location. */
export async function adjustInventory(
  ctx: ServiceCtx,
  input: {
    productId: string;
    locationId: string;
    delta: number;
    reason?: string;
  },
) {
  await db.insert(inventoryLedger).values({
    organizationId: ctx.orgId,
    productId: input.productId,
    locationId: input.locationId,
    quantityDelta: String(input.delta),
    reason: input.reason ?? "adjustment",
    actor: ctx.actor,
  });
  await recordAudit(ctx, {
    action: "inventory.adjust",
    entityType: "product",
    entityId: input.productId,
    after: { delta: input.delta, locationId: input.locationId, reason: input.reason },
  });
  return { onHand: await getOnHand(ctx, input.productId, input.locationId) };
}

/** Set the on-hand at a location to an absolute target by posting the delta. */
export async function setOnHand(
  ctx: ServiceCtx,
  input: {
    productId: string;
    locationId: string;
    target: number;
    reason?: string;
  },
) {
  const current = await getOnHand(ctx, input.productId, input.locationId);
  const delta = input.target - current;
  if (delta === 0) return { onHand: current };
  return adjustInventory(ctx, {
    productId: input.productId,
    locationId: input.locationId,
    delta,
    reason: input.reason ?? "set on-hand",
  });
}

/**
 * Set on-hand to the same target for many products at one location. Posts one
 * ledger movement per product (each stays auditable) but is driven by a single
 * approval in the Copilot.
 */
export async function bulkSetOnHand(
  ctx: ServiceCtx,
  input: { productIds: string[]; locationId: string; target: number },
) {
  let updated = 0;
  for (const productId of input.productIds) {
    await setOnHand(ctx, {
      productId,
      locationId: input.locationId,
      target: input.target,
      reason: "bulk set on-hand",
    });
    updated += 1;
  }
  return { updated };
}
