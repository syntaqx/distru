import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { assemblies, assemblyInputs, assemblyReservations } from "@/db/schema";
import type { ServiceCtx } from "@/lib/modules/shared";
import { datetime, num, recordAudit } from "@/lib/modules/shared";
import { getDefaultLocation } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";

export type AssemblyReservationRow = typeof assemblyReservations.$inferSelect;

/**
 * The reservation layer is a soft hold on input stock for a planned/in-progress
 * run, sitting *before* the real FIFO consumption that `postAssemblyInventory`
 * performs on completion. It prevents two planned runs from both counting on the
 * same units. Reservations are opened on IN_PROGRESS and released on
 * COMPLETE/CANCEL, so the ledger itself is never touched here.
 */

/** ACTIVE reservation lines for one assembly, oldest first. */
export async function getReservations(
  ctx: ServiceCtx,
  assemblyId: string,
  opts: { status?: "ACTIVE" | "RELEASED" } = {},
): Promise<AssemblyReservationRow[]> {
  const filters = [
    eq(assemblyReservations.organizationId, ctx.orgId),
    eq(assemblyReservations.assemblyId, assemblyId),
  ];
  if (opts.status) filters.push(eq(assemblyReservations.status, opts.status));
  return db
    .select()
    .from(assemblyReservations)
    .where(and(...filters))
    .orderBy(asc(assemblyReservations.createdAt));
}

/**
 * Reserve every input line of a not-yet-posted assembly against its location.
 * Idempotent: if the assembly already holds ACTIVE reservations they are
 * returned unchanged. A posted or line-less assembly reserves nothing.
 */
export async function reserveAssembly(
  ctx: ServiceCtx,
  assemblyId: string,
): Promise<AssemblyReservationRow[]> {
  const [asm] = await db
    .select()
    .from(assemblies)
    .where(and(eq(assemblies.organizationId, ctx.orgId), eq(assemblies.id, assemblyId)))
    .limit(1);
  if (!asm) throw new Error("Assembly not found.");
  // Real stock has already moved; a soft hold would be meaningless.
  if (asm.inventoryPosted) return getReservations(ctx, assemblyId, { status: "ACTIVE" });

  const existing = await getReservations(ctx, assemblyId, { status: "ACTIVE" });
  if (existing.length > 0) return existing;

  const inputs = await db
    .select()
    .from(assemblyInputs)
    .where(and(eq(assemblyInputs.assemblyId, assemblyId), isNotNull(assemblyInputs.productId)));
  const lines = inputs.filter((i) => i.productId && Number(i.quantity) > 0);
  if (lines.length === 0) return [];

  const locationId = asm.locationId ?? (await getDefaultLocation(ctx)).id;

  const rows = await db
    .insert(assemblyReservations)
    .values(
      lines.map((l) => ({
        organizationId: ctx.orgId,
        assemblyId,
        productId: l.productId!,
        locationId,
        quantity: String(l.quantity),
        status: "ACTIVE" as const,
      })),
    )
    .returning();

  await recordAudit(ctx, {
    action: "assembly.reserve",
    entityType: "assembly",
    entityId: assemblyId,
    after: { reserved: rows.length, locationId },
  });
  return rows;
}

/**
 * Release an assembly's ACTIVE reservations (on complete or cancel). Idempotent:
 * a no-op when there is nothing active. Returns the number released.
 */
export async function releaseAssembly(ctx: ServiceCtx, assemblyId: string): Promise<number> {
  const released = await db
    .update(assemblyReservations)
    .set({ status: "RELEASED", releasedAt: new Date() })
    .where(
      and(
        eq(assemblyReservations.organizationId, ctx.orgId),
        eq(assemblyReservations.assemblyId, assemblyId),
        eq(assemblyReservations.status, "ACTIVE"),
      ),
    )
    .returning({ id: assemblyReservations.id });
  if (released.length > 0) {
    await recordAudit(ctx, {
      action: "assembly.release",
      entityType: "assembly",
      entityId: assemblyId,
      after: { released: released.length },
    });
  }
  return released.length;
}

/** Map of productId -> total ACTIVE reserved quantity across the org. */
export async function reservedByProduct(ctx: ServiceCtx): Promise<Map<string, number>> {
  const rows = await db
    .select({
      productId: assemblyReservations.productId,
      total: sql<string>`coalesce(sum(${assemblyReservations.quantity}), 0)`,
    })
    .from(assemblyReservations)
    .where(
      and(
        eq(assemblyReservations.organizationId, ctx.orgId),
        eq(assemblyReservations.status, "ACTIVE"),
      ),
    )
    .groupBy(assemblyReservations.productId);
  const map = new Map<string, number>();
  for (const r of rows) if (r.productId) map.set(r.productId, Number(r.total));
  return map;
}

/**
 * Map of productId -> { onHand, reserved, available } where
 * available = onHand - reserved. Powers the "available to plan" figures shown
 * where inputs are chosen. `available` may go negative when a plan over-commits.
 */
export async function availableByProduct(
  ctx: ServiceCtx,
): Promise<Map<string, { onHand: number; reserved: number; available: number }>> {
  const [onHand, reserved] = await Promise.all([
    onHandByProduct(ctx),
    reservedByProduct(ctx),
  ]);
  const map = new Map<string, { onHand: number; reserved: number; available: number }>();
  const ids = new Set<string>([...onHand.keys(), ...reserved.keys()]);
  for (const id of ids) {
    const oh = onHand.get(id) ?? 0;
    const rv = reserved.get(id) ?? 0;
    map.set(id, { onHand: oh, reserved: rv, available: oh - rv });
  }
  return map;
}

export function reservationToApi(r: AssemblyReservationRow) {
  return {
    id: r.id,
    product_id: r.productId,
    location_id: r.locationId,
    quantity: num(r.quantity),
    status: r.status,
    reserved_datetime: datetime(r.createdAt),
    released_datetime: datetime(r.releasedAt),
  };
}
