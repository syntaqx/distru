/**
 * Stock transfers - auditable multi-location moves. A transfer FIFO-issues each
 * line from the source location and re-receives it into the destination at the
 * same per-lot cost (via `transferStock`), so cost travels with the goods and a
 * shortfall blocks the whole line. The `stock_transfers` row + lines are the
 * durable record an operator (or an auditor) can read back.
 *
 * Depends on: shared.
 */
import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, stockTransferLines, stockTransfers } from "@/db/schema";
import type { ServiceCtx } from "../shared";
import { datetime, num, recordAudit } from "../shared";
import { transferStock } from "./costing";

export type StockTransferRow = typeof stockTransfers.$inferSelect;
export type StockTransferLineRow = typeof stockTransferLines.$inferSelect;
export type StockTransferWithLines = StockTransferRow & { lines: StockTransferLineRow[] };

export type TransferLineInput = { productId: string; quantity: number | string };
export type CreateTransferInput = {
  fromLocationId: string;
  toLocationId: string;
  notes?: string | null;
  lines: TransferLineInput[];
};

/** Next per-org transfer number, e.g. TR-0001. */
export async function nextTransferNumber(ctx: ServiceCtx) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(stockTransfers)
    .where(eq(stockTransfers.organizationId, ctx.orgId));
  return `TR-${String(Number(value) + 1).padStart(4, "0")}`;
}

export async function listTransfers(
  ctx: ServiceCtx,
  { limit, offset }: { limit?: number; offset?: number } = {},
) {
  const lim = Math.min(Math.max(limit ?? 50, 1), 200);
  const off = Math.max(offset ?? 0, 0);
  const where = eq(stockTransfers.organizationId, ctx.orgId);
  const items = await db
    .select()
    .from(stockTransfers)
    .where(where)
    .orderBy(desc(stockTransfers.createdAt))
    .limit(lim)
    .offset(off);
  const [{ value: total }] = await db.select({ value: count() }).from(stockTransfers).where(where);
  return { items, total: Number(total), limit: lim, offset: off };
}

export async function getTransfer(
  ctx: ServiceCtx,
  id: string,
): Promise<StockTransferWithLines | null> {
  const [row] = await db
    .select()
    .from(stockTransfers)
    .where(and(eq(stockTransfers.organizationId, ctx.orgId), eq(stockTransfers.id, id)))
    .limit(1);
  if (!row) return null;
  const lines = await db
    .select()
    .from(stockTransferLines)
    .where(eq(stockTransferLines.transferId, id))
    .orderBy(asc(stockTransferLines.createdAt));
  return { ...row, lines };
}

/**
 * Create and immediately execute a transfer: move every line's stock between the
 * two locations (cost-preserving, blocking on shortfall), then persist the
 * transfer + lines as the audit record.
 */
export async function createTransfer(ctx: ServiceCtx, input: CreateTransferInput) {
  if (input.fromLocationId === input.toLocationId)
    throw new Error("Source and destination locations must differ.");
  if (!input.lines?.length) throw new Error("A transfer needs at least one line.");

  const transferNumber = await nextTransferNumber(ctx);
  const [transfer] = await db
    .insert(stockTransfers)
    .values({
      organizationId: ctx.orgId,
      transferNumber,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      status: "COMPLETED",
      notes: input.notes ?? null,
    })
    .returning();

  for (const line of input.lines) {
    const { movedCost } = await transferStock(ctx, {
      productId: line.productId,
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      qty: Number(line.quantity),
      reason: `transfer:${transferNumber}`,
      refId: transfer.id,
    });
    await db.insert(stockTransferLines).values({
      organizationId: ctx.orgId,
      transferId: transfer.id,
      productId: line.productId,
      quantity: String(line.quantity),
      movedCost: String(movedCost),
    });
  }

  await recordAudit(ctx, {
    action: "inventory.transfer",
    entityType: "stock_transfer",
    entityId: transfer.id,
    after: {
      transferNumber,
      from: input.fromLocationId,
      to: input.toLocationId,
      lines: input.lines.length,
    },
  });
  return (await getTransfer(ctx, transfer.id))!;
}

export async function transferToApi(ctx: ServiceCtx, row: StockTransferWithLines) {
  const locs = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.organizationId, ctx.orgId));
  const nameOf = (id: string | null) => locs.find((l) => l.id === id)?.name ?? null;
  return {
    id: row.id,
    transfer_number: row.transferNumber,
    status: row.status,
    from_location: row.fromLocationId ? { id: row.fromLocationId, name: nameOf(row.fromLocationId) } : null,
    to_location: row.toLocationId ? { id: row.toLocationId, name: nameOf(row.toLocationId) } : null,
    notes: row.notes ?? null,
    lines: row.lines.map((l) => ({
      id: l.id,
      product_id: l.productId,
      quantity: num(l.quantity),
      moved_cost: num(l.movedCost),
    })),
    inserted_datetime: datetime(row.createdAt),
    updated_datetime: datetime(row.updatedAt),
  };
}
