/**
 * Metrc provider — the state track-and-trace system Distru syncs with. This is a
 * MOCK adapter (`METRC_PROVIDER=mock`, the default) that returns **API-accurate**
 * data shaped exactly like Distru's documented Metrc schemas (MetrcPackage,
 * MetrcItem, MetrcStrain, MetrcTag, MetrcLocation, MetrcTransfer), seeded
 * deterministically from the org's real catalog/inventory so a Metrc package maps
 * to an actual product's on-hand. A real adapter would call the live Metrc API
 * behind the same interface; `METRC_PROVIDER=none` behaves as unconnected.
 */
import { env } from "@/lib/env";
import type { ServiceCtx } from "@/lib/modules/shared";
import { listProducts, listLocations, listStrains } from "@/lib/modules/catalog";
import { onHandByProduct } from "@/lib/modules/inventory";
import { listOrders } from "@/lib/modules/sales";
import { hashNumericId, metrcTag, isoMicro, pick } from "./util";

type Ref = { id: number | string; name: string };
type License = {
  id: number;
  license_number: string;
  license_type: string;
  active: boolean;
  issue_datetime: string;
  expiry_datetime: string;
  inserted_datetime: string;
};
type Page<T> = { data: T[]; next_page: string | null };

export interface MetrcProvider {
  readonly id: string;
  listPackages(ctx: ServiceCtx): Promise<Page<Record<string, unknown>>>;
  getPackage(ctx: ServiceCtx, label: string): Promise<Record<string, unknown> | null>;
  listItems(ctx: ServiceCtx): Promise<Page<Record<string, unknown>>>;
  listStrains(ctx: ServiceCtx): Promise<Page<Record<string, unknown>>>;
  listTags(ctx: ServiceCtx): Promise<Page<Record<string, unknown>>>;
  getTag(ctx: ServiceCtx, id: string): Promise<Record<string, unknown> | null>;
  listLocations(ctx: ServiceCtx): Promise<Page<Record<string, unknown>>>;
  listTransfers(ctx: ServiceCtx): Promise<Page<Record<string, unknown>>>;
  getTransfer(ctx: ServiceCtx, manifest: string): Promise<Record<string, unknown> | null>;
  listLabTestBatches(ctx: ServiceCtx): Promise<Page<Record<string, unknown>>>;
}

const BASE = new Date("2025-01-06T17:00:00Z");
const LAB_STATES = ["TestPassed", "NotSubmitted", "SubmittedForTesting"] as const;
const CATEGORY_TYPES = ["Buds", "Concentrate", "InfusedEdible", "Extract"] as const;

/** A stable Metrc license for the org (every Metrc row carries one). */
function license(ctx: ServiceCtx): License {
  const n = hashNumericId(`lic:${ctx.orgId}`, 6);
  return {
    id: hashNumericId(`licid:${ctx.orgId}`, 6),
    license_number: `C11-000${String(n).padStart(4, "0")}-LIC`,
    license_type: "Distributor",
    active: true,
    issue_datetime: isoMicro(BASE, -86400 * 365),
    expiry_datetime: isoMicro(BASE, 86400 * 365),
    inserted_datetime: isoMicro(BASE, -86400 * 365),
  };
}

function manifest(orderId: string): string {
  return `000${hashNumericId(`manifest:${orderId}`, 10)}`;
}

async function activeProducts(ctx: ServiceCtx) {
  const { items } = await listProducts(ctx, { status: "ACTIVE", limit: 500 });
  return items;
}

function metrcItem(ctx: ServiceCtx, p: Awaited<ReturnType<typeof activeProducts>>[number]): Record<string, unknown> {
  const r = p.product;
  return {
    id: hashNumericId(`metrc:item:${r.id}`, 8),
    name: r.name,
    category_name: p.category?.name ?? "Flower",
    category_type: pick(CATEGORY_TYPES, r.id),
    quantity_type: r.inventoryTrackingMethod === "PACKAGE" ? "CountBased" : "WeightBased",
    unit_type: p.unitType ? { id: p.unitType.id, name: p.unitType.name } : null,
    strain: p.strain ? { id: hashNumericId(`metrc:strain:${p.strain.id}`, 6), name: p.strain.name } : null,
    license: license(ctx),
    is_deleted: false,
    fetched_datetime: isoMicro(BASE),
    inserted_datetime: isoMicro(BASE, -86400 * 30),
    updated_datetime: isoMicro(BASE, -86400 * 2),
  };
}

function metrcLocation(ctx: ServiceCtx, loc: { id: string; name: string }): Record<string, unknown> {
  return {
    id: hashNumericId(`metrc:loc:${loc.id}`, 6),
    name: loc.name,
    location_type_name: "Default Location",
    for_packages: true,
    for_plants: false,
    for_plant_batches: false,
    for_harvests: false,
    license: license(ctx),
    is_deleted: false,
    fetched_datetime: isoMicro(BASE),
  };
}

export const mockMetrcProvider: MetrcProvider = {
  id: "metrc-mock",

  async listPackages(ctx) {
    const [products, qty, locs] = await Promise.all([
      activeProducts(ctx),
      onHandByProduct(ctx),
      listLocations(ctx),
    ]);
    const loc = locs[0] ?? { id: "loc", name: "Main Warehouse" };
    const data = products
      .filter((p) => (qty.get(p.product.id) ?? 0) > 0)
      .map((p) => {
        const r = p.product;
        return {
          id: hashNumericId(`metrc:pkg:${r.id}`, 8),
          label: metrcTag(`metrc:pkg:${r.id}`),
          package: { id: r.id, name: r.name },
          item: metrcItem(ctx, p),
          quantity: (qty.get(r.id) ?? 0).toFixed(6),
          unit_type: p.unitType ? { id: p.unitType.id, name: p.unitType.name } : null,
          location: metrcLocation(ctx, loc) as unknown as Ref,
          status: "active",
          packaged_date: isoMicro(BASE, -86400 * 14).slice(0, 10),
          lab_testing_state: pick(LAB_STATES, r.id),
          lab_testing_state_date: isoMicro(BASE, -86400 * 10).slice(0, 10),
          is_production_batch: false,
          is_testing_sample: false,
          is_trade_sample: false,
          is_finished_good: true,
          contains_remediated_product: false,
          product_requires_remediation: false,
          production_batch_number: null,
          source_package_labels: null,
          source_harvest_names: null,
          received_from_manifest_number: null,
          received_from_facility_name: null,
          received_from_facility_license_number: null,
          finished_date: null,
          expiration_date: isoMicro(BASE, 86400 * 180).slice(0, 10),
          remediation_date: null,
          archived_date: null,
          note: null,
          license: license(ctx),
          received_datetime: isoMicro(BASE, -86400 * 14),
          transferred_datetime: null,
          fetched_datetime: isoMicro(BASE),
          updated_datetime: isoMicro(BASE, -86400),
        };
      });
    return { data, next_page: null };
  },

  async getPackage(ctx, label) {
    const { data } = await this.listPackages(ctx);
    return data.find((p) => p.label === label) ?? null;
  },

  async listItems(ctx) {
    const products = await activeProducts(ctx);
    return { data: products.map((p) => metrcItem(ctx, p)), next_page: null };
  },

  async listStrains(ctx) {
    const { items: strains } = await listStrains(ctx, { limit: 200 });
    const data = strains.map((s) => ({
      id: hashNumericId(`metrc:strain:${s.id}`, 6),
      name: s.name,
      thc_level: String((hashNumericId(`thc:${s.id}`, 3) % 300) / 10),
      cbd_level: String((hashNumericId(`cbd:${s.id}`, 2) % 50) / 10),
      indica_percentage: String(hashNumericId(`ind:${s.id}`, 2) % 100),
      sativa_percentage: String(hashNumericId(`sat:${s.id}`, 2) % 100),
      genetics: "Hybrid",
      testing_status: "None",
      license: license(ctx),
      is_deleted: false,
      is_used: true,
    }));
    return { data, next_page: null };
  },

  async listTags(ctx) {
    // A pool of RFID tags: those assigned to packages, plus a few available ones.
    const products = await activeProducts(ctx);
    const assigned = products.map((p) => ({
      id: String(hashNumericId(`metrc:tagid:${p.product.id}`, 9)),
      tag: metrcTag(`metrc:pkg:${p.product.id}`),
      kind: "CannabisPackage",
      is_assigned: true,
      assigned_datetime: isoMicro(BASE, -86400 * 14),
      commissioned_date: isoMicro(BASE, -86400 * 30).slice(0, 10),
      license_id: String(hashNumericId(`licid:${ctx.orgId}`, 6)),
      inserted_datetime: isoMicro(BASE, -86400 * 30),
      updated_datetime: isoMicro(BASE, -86400 * 14),
    }));
    const available = Array.from({ length: 5 }, (_, i) => ({
      id: String(hashNumericId(`metrc:tagavail:${ctx.orgId}:${i}`, 9)),
      tag: metrcTag(`metrc:avail:${ctx.orgId}:${i}`),
      kind: "CannabisPackage",
      is_assigned: false,
      assigned_datetime: null,
      commissioned_date: isoMicro(BASE, -86400 * 5).slice(0, 10),
      license_id: String(hashNumericId(`licid:${ctx.orgId}`, 6)),
      inserted_datetime: isoMicro(BASE, -86400 * 5),
      updated_datetime: isoMicro(BASE, -86400 * 5),
    }));
    return { data: [...assigned, ...available], next_page: null };
  },

  async getTag(ctx, id) {
    const { data } = await this.listTags(ctx);
    return data.find((t) => t.id === id) ?? null;
  },

  async listLocations(ctx) {
    const locs = await listLocations(ctx);
    return { data: locs.map((l) => metrcLocation(ctx, l)), next_page: null };
  },

  async listTransfers(ctx) {
    const { items } = await listOrders(ctx, { limit: 100 });
    const data = items.map((o) => {
      const ord = o.order;
      return {
        id: hashNumericId(`metrc:transfer:${ord.id}`, 8),
        manifest_number: manifest(ord.id),
        direction: "Outgoing",
        shipment_type_name: "Transfer",
        is_importable: true,
        importable_details: null,
        deliveries: [],
        order: { id: ord.id, order_number: ord.orderNumber },
        purchase: null,
        shipper_name: "Green Leaf Collective",
        shipper_license_number: license(ctx).license_number,
        transporter_name: "Green Leaf Logistics",
        transporter_license_number: license(ctx).license_number,
        received_datetime: null,
        license: license(ctx),
        fetched_datetime: isoMicro(BASE),
        inserted_datetime: isoMicro(BASE, -86400 * 3),
        updated_datetime: isoMicro(BASE, -86400 * 3),
      };
    });
    return { data, next_page: null };
  },

  async getTransfer(ctx, manifestNumber) {
    const { data } = await this.listTransfers(ctx);
    return data.find((t) => t.manifest_number === manifestNumber) ?? null;
  },

  async listLabTestBatches() {
    // Metrc's required lab-test batch categories (California-style set).
    const names = [
      "Cannabinoids",
      "Foreign Material",
      "Heavy Metals",
      "Microbials",
      "Mycotoxins",
      "Moisture Content",
      "Pesticides",
      "Residual Solvents",
      "Terpenes",
      "Water Activity",
    ];
    return { data: names.map((name) => ({ name, required: true })), next_page: null };
  },
};

const noneMetrcProvider: MetrcProvider = {
  id: "none",
  async listPackages() {
    return { data: [], next_page: null };
  },
  async getPackage() {
    return null;
  },
  async listItems() {
    return { data: [], next_page: null };
  },
  async listStrains() {
    return { data: [], next_page: null };
  },
  async listTags() {
    return { data: [], next_page: null };
  },
  async getTag() {
    return null;
  },
  async listLocations() {
    return { data: [], next_page: null };
  },
  async listTransfers() {
    return { data: [], next_page: null };
  },
  async getTransfer() {
    return null;
  },
  async listLabTestBatches() {
    return { data: [], next_page: null };
  },
};

export function getMetrcProvider(): MetrcProvider {
  return env.metrcProvider === "none" ? noneMetrcProvider : mockMetrcProvider;
}
