import type { ImportTarget } from "./target";
import { productsTarget } from "./targets/products";
import { customersTarget } from "./targets/customers";
import { vendorsTarget } from "./targets/vendors";
import { priceListTarget } from "./targets/price-list";
import { inventoryCountTarget } from "./targets/inventory-count";

// Register import targets here. Adding one makes the entire import experience
// (detection, mapping, validation, partial commit, error CSV) work for a new
// entity - no pipeline changes.
const TARGETS: ImportTarget<unknown, unknown>[] = [
  productsTarget as ImportTarget<unknown, unknown>,
  customersTarget as ImportTarget<unknown, unknown>,
  vendorsTarget as ImportTarget<unknown, unknown>,
  priceListTarget as ImportTarget<unknown, unknown>,
  inventoryCountTarget as ImportTarget<unknown, unknown>,
];

const byKey = new Map(TARGETS.map((t) => [t.key, t]));

export function getTarget(key: string): ImportTarget<unknown, unknown> {
  const target = byKey.get(key);
  if (!target) throw new Error(`Unknown import target: ${key}`);
  return target;
}

export function listTargets() {
  return TARGETS.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    fields: t.fields,
  }));
}
