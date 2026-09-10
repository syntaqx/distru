import { z } from "zod";
import { defineTool } from "../tool";
import type { HarnessToolPreview } from "../types";
import { createTransfer, scanCode } from "@/lib/modules/inventory";
import { findOrCreateLocation } from "@/lib/modules/catalog";
import { resolveProduct } from "./_helpers";

function confirm(
  title: string,
  summary: string,
  fields: { label: string; value: string }[],
  risk: "low" | "medium" | "high" = "medium",
): HarnessToolPreview {
  return { kind: "confirmation", title, summary, fields, risk };
}

export const transferStockTool = defineTool({
  name: "transfer_stock",
  description:
    "Move stock of one or more products between two locations. Cost travels with " +
    "the goods (FIFO), and the move blocks if a line exceeds on-hand at the source. " +
    "Creates an auditable stock transfer.",
  gate: "confirmation",
  inputSchema: z.object({
    from_location: z.string().describe("Source location name"),
    to_location: z.string().describe("Destination location name"),
    lines: z
      .array(
        z.object({
          product: z.string().describe("SKU or product name"),
          quantity: z.number().positive(),
        }),
      )
      .min(1),
    notes: z.string().optional(),
  }),
  async buildPreview(input) {
    return confirm(
      "Transfer stock",
      `Move ${input.lines.length} line(s) from ${input.from_location} to ${input.to_location}.`,
      input.lines.map((l) => ({ label: l.product, value: String(l.quantity) })),
      "medium",
    );
  },
  async execute(input, ctx) {
    const from = await findOrCreateLocation(ctx.service, input.from_location);
    const to = await findOrCreateLocation(ctx.service, input.to_location);
    const lines: { productId: string; quantity: number }[] = [];
    const missing: string[] = [];
    for (const l of input.lines) {
      const p = await resolveProduct(ctx.service, { sku: l.product, name: l.product });
      if (!p) {
        missing.push(l.product);
        continue;
      }
      lines.push({ productId: p.product.id, quantity: l.quantity });
    }
    if (lines.length === 0)
      return { ok: false, summary: `No products matched (${missing.join(", ")}).` };
    try {
      const transfer = await createTransfer(ctx.service, {
        fromLocationId: from.id,
        toLocationId: to.id,
        notes: input.notes ?? null,
        lines,
      });
      const warn = missing.length ? ` (unmatched: ${missing.join(", ")})` : "";
      return {
        ok: true,
        summary: `Transfer ${transfer.transferNumber}: moved ${lines.length} line(s) ${input.from_location} → ${input.to_location}${warn}.`,
        data: { transfer_number: transfer.transferNumber, lines: lines.length },
      };
    } catch (err) {
      return { ok: false, summary: err instanceof Error ? err.message : "Transfer failed." };
    }
  },
});

export const scanCodeTool = defineTool({
  name: "scan_code",
  description:
    "Look up a scanned code - a package tag, Metrc tag, barcode, serial number, " +
    "or product SKU - and return what it identifies (a package or a product).",
  gate: "none",
  inputSchema: z.object({
    code: z.string().describe("The scanned code"),
  }),
  async execute(input, ctx) {
    const found = await scanCode(ctx.service, input.code);
    if (!found) return { ok: true, summary: `No match for "${input.code}".`, data: { match: null } };
    if (found.kind === "package") {
      const p = found.package;
      return {
        ok: true,
        summary: `Package ${p.packageTag} (${p.status}), qty ${p.quantity}.`,
        data: {
          kind: "package",
          package_tag: p.packageTag,
          product_id: p.productId,
          quantity: p.quantity,
          status: p.status,
        },
      };
    }
    return {
      ok: true,
      summary: `Product ${found.product.name} (${found.product.sku}).`,
      data: { kind: "product", sku: found.product.sku, name: found.product.name },
    };
  },
});

export const inventoryTools = [transferStockTool, scanCodeTool];
