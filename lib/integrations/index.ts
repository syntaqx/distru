/**
 * External-integration providers — mock adapters that return API-accurate data
 * for the systems Distru connects to (Metrc, QuickBooks, LeafLink, BioTrack).
 * Each is env-selected and swappable for a real adapter; import from this barrel.
 */
export { getMetrcProvider, mockMetrcProvider, type MetrcProvider } from "./metrc";
export {
  getAccountingProvider,
  getMarketplaceProvider,
  getTraceabilityProvider,
  type AccountingProvider,
  type MarketplaceProvider,
  type TraceabilityProvider,
} from "./sync";
