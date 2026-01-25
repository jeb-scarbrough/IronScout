/**
 * Dashboard v5 Components
 *
 * Per ADR-020, dashboard-product-spec-v5.md, v5-patch-001, and ambient-vitality spec
 */

// ============================================
// Final Implementation (with Ambient Vitality)
// ============================================

// Main layout (with ambient vitality)
export { DashboardV5Vital, DashboardV5VitalSkeleton } from './dashboard-v5-vital'
export type { DashboardV5VitalData } from './dashboard-v5-vital'

// Ambient vitality components
export { ActiveMonitoringHeader, selectMonitoringVariant } from './active-monitoring-header'
export { MarketPulseStrip, generateCaliberTrends } from './market-pulse-strip'
export type { CaliberTrend } from './market-pulse-strip'
export { CoverageContext, generateCoverageObservation, COVERAGE_TEMPLATES } from './coverage-context'
export type { CoverageObservation, CoverageObservationType } from './coverage-context'

// ============================================
// Updated Components (per v5-patch-001)
// ============================================

// Main layout (updated, pre-vitality)
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

// Vitality components (basic)
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
