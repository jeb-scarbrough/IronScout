// Result card components
export { ResultCard, ResultCardSkeleton } from './result-card'
export type { ResultCardProps, CardBadge, BadgeType } from './result-card'

// Result row components (grid/table view)
export { ResultRow, ResultTableHeader, ResultRowSkeleton } from './result-row'
export type { ResultRowProps, GridSort, GridSortColumn } from './result-row'

// View toggle
export { ViewToggle } from './view-toggle'
export type { ViewMode } from './view-toggle'

// Search result adapters
export { SearchResultCard } from './search-result-card'
export { SearchResultRow } from './search-result-row'

// Dashboard "For You" adapter
export { ForYouResultCard } from './for-you-result-card'

// Search results grid (client component with tracking state + view toggle)
export { SearchResultsGrid, SearchResultsGridSkeleton } from './search-results-grid'

// ============================================
// V2 Components (per search-results-ux-spec.md)
// ============================================

// Types
export type {
  ShippingInfo,
  RetailerPrice,
  ProductWithRetailers,
  ResultCardV2Props,
  ResultRowV2Props,
  RetailerPanelProps,
  RetailerSortOption,
} from './types'
export {
  formatShippingInfo,
  formatShippingInfoShort,
  formatPrice,
  formatPricePerRound,
  sortRetailers,
  getLowestPrice,
  truncate,
  RETAILER_SORT_OPTIONS,
} from './types'

// Result card v2 (multi-retailer inline comparison)
export { ResultCardV2, ResultCardV2Skeleton } from './result-card-v2'

// Result row v2 (retailer count + panel pattern)
export { ResultRowV2, ResultRowV2Skeleton, ResultTableHeaderV2 } from './result-row-v2'

// Retailer panel (comparison drawer)
export { RetailerPanel } from './retailer-panel'

// Search results grid v2
export { SearchResultsGridV2, SearchResultsGridV2Skeleton } from './search-results-grid-v2'
