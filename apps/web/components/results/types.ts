/**
 * Search Results v2 Types
 *
 * Per search-results-ux-spec.md
 */

// ============================================
// Shipping Info
// ============================================

/**
 * Shipping information union type
 * Represents all possible shipping states honestly
 */
export type ShippingInfo =
  | { type: 'included' }
  | { type: 'excluded'; amount: number }
  | { type: 'excluded_unknown' }
  | { type: 'free_over'; threshold: number }
  | { type: 'pickup_only' }
  | { type: 'unknown' }

/**
 * Format shipping info for display
 */
export function formatShippingInfo(info: ShippingInfo): string | null {
  switch (info.type) {
    case 'included':
      return 'Shipping included'
    case 'excluded':
      return `+$${info.amount.toFixed(2)} shipping`
    case 'excluded_unknown':
      return '+ shipping'
    case 'free_over':
      return `Free ship $${info.threshold}+`
    case 'pickup_only':
      return 'Pickup only'
    case 'unknown':
      return null
  }
}

/**
 * Format shipping info for inline display (shorter)
 */
export function formatShippingInfoShort(info: ShippingInfo): string | null {
  switch (info.type) {
    case 'included':
      return 'delivered'
    case 'excluded':
      return `+$${info.amount.toFixed(2)} ship`
    case 'excluded_unknown':
      return '+ shipping'
    case 'free_over':
      return `free $${info.threshold}+`
    case 'pickup_only':
      return 'pickup'
    case 'unknown':
      return null
  }
}

// ============================================
// Retailer Price
// ============================================

/**
 * Full retailer price data for comparison
 */
export interface RetailerPrice {
  retailerId: string
  retailerName: string
  pricePerRound: number
  totalPrice: number
  inStock: boolean
  shippingInfo: ShippingInfo
  url: string
  lastUpdated?: string // ISO date string
}

// ============================================
// Product with Retailers
// ============================================

/**
 * Product data with full retailer array for v2 components
 */
export interface ProductWithRetailers {
  id: string
  name: string
  caliber: string
  bulletType?: string
  grainWeight?: number
  caseMaterial?: string
  roundCount?: number
  retailers: RetailerPrice[]
}

// ============================================
// Component Props
// ============================================

/**
 * Props for ResultCardV2
 */
export interface ResultCardV2Props {
  id: string
  productTitle: string
  caliber: string
  bulletType?: string
  grainWeight?: number
  caseMaterial?: string
  roundCount?: number
  retailers: RetailerPrice[]
  isWatched: boolean
  onWatchToggle: (productId: string) => void
  onCompareClick: (productId: string) => void
}

/**
 * Props for ResultRowV2
 */
export interface ResultRowV2Props {
  id: string
  productTitle: string
  caliber: string
  bulletType?: string
  grainWeight?: number
  roundCount?: number
  lowestPricePerRound: number
  retailerCount: number
  anyInStock: boolean
  isWatched: boolean
  onWatchToggle: (productId: string) => void
  onCompareClick: (productId: string) => void
}

/**
 * Props for RetailerPanel
 */
export interface RetailerPanelProps {
  isOpen: boolean
  onClose: () => void
  product: {
    id: string
    name: string
    caliber: string
    bulletType?: string
    grainWeight?: number
    caseMaterial?: string
    roundCount?: number
  } | null
  retailers: RetailerPrice[]
  isWatched?: boolean
  onWatchToggle?: (productId: string) => void
}

/**
 * Sort options for retailer panel
 */
export type RetailerSortOption =
  | 'price_asc'
  | 'price_desc'
  | 'retailer_asc'
  | 'in_stock_first'

export const RETAILER_SORT_OPTIONS: { value: RetailerSortOption; label: string }[] = [
  { value: 'price_asc', label: 'Price (low-high)' },
  { value: 'price_desc', label: 'Price (high-low)' },
  { value: 'retailer_asc', label: 'Retailer A-Z' },
  { value: 'in_stock_first', label: 'In-stock first' },
]

/**
 * Sort retailers by the selected option
 */
export function sortRetailers(
  retailers: RetailerPrice[],
  sortBy: RetailerSortOption
): RetailerPrice[] {
  const sorted = [...retailers]

  switch (sortBy) {
    case 'price_asc':
      return sorted.sort((a, b) => a.pricePerRound - b.pricePerRound)
    case 'price_desc':
      return sorted.sort((a, b) => b.pricePerRound - a.pricePerRound)
    case 'retailer_asc':
      return sorted.sort((a, b) => a.retailerName.localeCompare(b.retailerName))
    case 'in_stock_first':
      return sorted.sort((a, b) => {
        if (a.inStock && !b.inStock) return -1
        if (!a.inStock && b.inStock) return 1
        return a.pricePerRound - b.pricePerRound
      })
    default:
      return sorted
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Get the lowest in-stock price from retailers
 * Falls back to lowest OOS price if none in stock
 */
export function getLowestPrice(retailers: RetailerPrice[]): RetailerPrice | null {
  if (retailers.length === 0) return null

  const inStock = retailers.filter((r) => r.inStock)
  if (inStock.length > 0) {
    return inStock.reduce((min, r) =>
      r.pricePerRound < min.pricePerRound ? r : min
    )
  }

  // All OOS - return lowest anyway
  return retailers.reduce((min, r) =>
    r.pricePerRound < min.pricePerRound ? r : min
  )
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trim() + '…'
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`
}

/**
 * Format price per round for display
 */
export function formatPricePerRound(price: number): string {
  return `$${price.toFixed(2)}/rd`
}
