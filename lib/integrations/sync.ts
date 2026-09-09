/**
 * Mock "sync" providers for the external systems Distru integrates with, that
 * only surface as ids/flags on domain records: QuickBooks (accounting),
 * LeafLink (marketplace), and Metrc/BioTrack (traceability). Each is env-
 * selected (`ACCOUNTING_PROVIDER` / `MARKETPLACE_PROVIDER` / `TRACEABILITY_PROVIDER`,
 * default "mock"); "none" returns null everywhere, as if unconnected. Ids are
 * deterministic in the entity id, so they're stable and API-accurately shaped.
 */
import { env } from "@/lib/env";
import { hashNumericId, hashHex, metrcTag } from "./util";

// ---------------- Accounting (QuickBooks) ----------------

export interface AccountingProvider {
  readonly id: string;
  /** QuickBooks customer id for a company, or null when unconnected. */
  customerId(companyId: string): string | null;
  /** QuickBooks vendor id for a company. */
  vendorId(companyId: string): string | null;
  /** The QuickBooks deposit account a payment settles into. */
  depositAccount(): { id: string; name: string } | null;
}

const mockAccounting: AccountingProvider = {
  id: "quickbooks-mock",
  customerId: (companyId) => String(hashNumericId(`qb:cust:${companyId}`, 9)),
  vendorId: (companyId) => String(hashNumericId(`qb:vend:${companyId}`, 9)),
  depositAccount: () => ({ id: "35", name: "Undeposited Funds" }),
};

const noneAccounting: AccountingProvider = {
  id: "none",
  customerId: () => null,
  vendorId: () => null,
  depositAccount: () => null,
};

export function getAccountingProvider(): AccountingProvider {
  return env.accountingProvider === "none" ? noneAccounting : mockAccounting;
}

// ---------------- Marketplace (LeafLink) ----------------

export interface MarketplaceProvider {
  readonly id: string;
  orderId(orderId: string): number | null;
  orderNumber(orderId: string): string | null;
  brandId(companyId: string): number | null;
  customerId(companyId: string): number | null;
  productId(productId: string): number | null;
}

const mockMarketplace: MarketplaceProvider = {
  id: "leaflink-mock",
  orderId: (id) => hashNumericId(`ll:order:${id}`, 8),
  orderNumber: (id) => `LL-${hashNumericId(`ll:ordernum:${id}`, 6)}`,
  brandId: (id) => hashNumericId(`ll:brand:${id}`, 6),
  customerId: (id) => hashNumericId(`ll:cust:${id}`, 7),
  productId: (id) => hashNumericId(`ll:prod:${id}`, 7),
};

const noneMarketplace: MarketplaceProvider = {
  id: "none",
  orderId: () => null,
  orderNumber: () => null,
  brandId: () => null,
  customerId: () => null,
  productId: () => null,
};

export function getMarketplaceProvider(): MarketplaceProvider {
  return env.marketplaceProvider === "none" ? noneMarketplace : mockMarketplace;
}

// ---------------- Traceability (Metrc / BioTrack) ----------------

export interface TraceabilityProvider {
  readonly id: string;
  metrcTransferId(orderId: string): string | null;
  metrcTransferTemplateId(orderId: string): string | null;
  biotrackId(entityId: string): string | null;
  /** A Metrc package RFID tag for a product/package entity. */
  metrcLabel(entityId: string): string | null;
  /** A Metrc catalog item id for a product. */
  metrcItemId(productId: string): number | null;
}

const mockTraceability: TraceabilityProvider = {
  id: "metrc-mock",
  metrcTransferId: (id) => String(hashNumericId(`metrc:transfer:${id}`, 10)),
  metrcTransferTemplateId: (id) => String(hashNumericId(`metrc:tmpl:${id}`, 10)),
  biotrackId: (id) => hashHex(`biotrack:${id}`, 16),
  metrcLabel: (id) => metrcTag(`metrc:pkg:${id}`),
  metrcItemId: (id) => hashNumericId(`metrc:item:${id}`, 8),
};

const noneTraceability: TraceabilityProvider = {
  id: "none",
  metrcTransferId: () => null,
  metrcTransferTemplateId: () => null,
  biotrackId: () => null,
  metrcLabel: () => null,
  metrcItemId: () => null,
};

export function getTraceabilityProvider(): TraceabilityProvider {
  return env.traceabilityProvider === "none" ? noneTraceability : mockTraceability;
}
