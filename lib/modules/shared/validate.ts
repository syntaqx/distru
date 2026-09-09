/**
 * Cross-cutting domain validation shared by the order/PO/return line-item paths.
 * Enforced in the module create functions so every face (REST, MCP, UI, imports)
 * gets the same guarantees - a line can never carry a zero or negative quantity,
 * which would otherwise produce negative totals and move inventory the wrong way.
 */

export function assertPositiveQuantities(items: { quantity: number | string }[]) {
  for (const [i, item] of items.entries()) {
    const q = Number(item.quantity);
    if (!Number.isFinite(q) || q <= 0) {
      throw new Error(
        `Line ${i + 1}: quantity must be a positive number (got ${JSON.stringify(item.quantity)}).`,
      );
    }
  }
}
