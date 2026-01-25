/**
 * Dashboard v5 Components
 *
 * Per ADR-020, dashboard-product-spec-v5.md, and v5-patch-001
 */

// ============================================
// Updated Components (per v5-patch-001)
// ============================================

// Main layout (updated)
export { DashboardV5Updated, DashboardV5UpdatedSkeleton } from './dashboard-v5-updated'
export type { DashboardV5UpdatedData } from './dashboard-v5-updated'

// Spotlight (demoted to notice bar)
export { SpotlightNotice } from './spotlight-notice'
export type { SpotlightReason } from './spotlight-notice'

// Watchlist (table, not cards)
export { WatchlistTable } from './watchlist-table'
export type { WatchlistTableItem, WatchlistStatusType } from './watchlist-table'

// Price Movement (collapsed accordion, not feed)
export { PriceMovementAccordion } from './price-movement-accordion'
export type { PriceChange } from './price-movement-accordion'

// Vitality components
export { MonitoringSummary } from './monitoring-summary'
export { MarketContext, generateMarketObservation } from './market-context'
export type { MarketObservation, MarketObservationType } from './market-context'
export { Sparkline, normalizeSparklineData } from './sparkline'

// ============================================
// Legacy Components (retained for migration)
// ============================================

// Main layout (legacy)
export { DashboardV5 } from './dashboard-v5'

// Section components (legacy)
export { SectionHeader } from './section-header'
export { SpotlightCard } from './spotlight-card'
export { WatchlistRow } from './watchlist-row'
export { AlertRow } from './alert-row'
export { ContextRow } from './context-row'
export { ColdStartModule } from './cold-start-module'

// Types (legacy)
export type {
  SignalAge,
  BadgeType,
  WatchlistStatus,
  SpotlightSignalType,
  SpotlightData,
  WatchlistItem,
  AlertItem,
  GunLockerMatchItem,
  DashboardV5Data,
} from './types'
