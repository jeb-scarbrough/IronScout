// Dashboard hooks
export { useMarketPulse } from './use-market-pulse'
export { useDealsForYou } from './use-deals-for-you'
export { useSavings } from './use-savings'
export { useDashboardStats } from './use-dashboard-stats'
export { useDashboardV5 } from './use-dashboard-v5'
export type { UseDashboardV5Result } from './use-dashboard-v5'

// Saved Items (ADR-011 - replaces watchlist/alerts)
export { useSavedItems } from './use-saved-items'
export type { UseSavedItemsResult } from './use-saved-items'

// Legacy (deprecated - use useSavedItems instead)
/** @deprecated Use useSavedItems instead */
export { useWatchlist } from './use-watchlist'
