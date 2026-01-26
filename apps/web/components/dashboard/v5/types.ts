/**
 * Dashboard v5 Types
 *
 * Per ADR-020 and dashboard-product-spec-v5.md
 */

// Signal lifecycle states for badge decay
export type SignalAge = 'ACTIVE' | 'STALE' | 'CLEARED'

// Badge types for alert rows
export type BadgeType = '90-day-low' | 'price-drop' | 'back-in-stock'

// Status types for watchlist rows (factual, no judgment)
export type WatchlistStatus =
  | 'lowest-90-days'
  | 'price-moved'
  | 'back-in-stock'
  | null

// Spotlight signal types
export type SpotlightSignalType =
  | 'largest-price-movement'
  | 'back-in-stock-watched'
  | 'lowest-90-days'

export interface SpotlightData {
  productId: string
  productName: string
  attributes: string // e.g., "9mm Luger · FMJ · 115gr"
  pricePerRound: number
  retailerName: string
  signalType: SpotlightSignalType
  signalAge: SignalAge
  changePercent?: number // for price movements
  previousPrice?: number
}

export interface WatchlistItem {
  id: string
  productId: string
  productName: string
  attributes: string
  pricePerRound: number | null
  status: WatchlistStatus
  inStock: boolean
}

export interface AlertItem {
  id: string
  productId: string
  productName: string
  attributes: string
  pricePerRound: number
  retailerName: string
  badgeType: BadgeType
  signalAge: SignalAge
  explanation: string // Factual explanation, e.g., "Lowest price observed in last 90 days"
}

export interface GunLockerMatchItem {
  id: string
  productId: string
  productName: string
  attributes: string
  pricePerRound: number
  matchedCaliber: string // e.g., "9mm" - the caliber from gun locker that matched
}

export interface DashboardV5Data {
  spotlight: SpotlightData | null
  watchlist: {
    items: WatchlistItem[]
    totalCount: number
  }
  priceMovement: AlertItem[]
  backInStock: AlertItem[]
  gunLockerMatches: GunLockerMatchItem[]
  hasGunLocker: boolean
  lastUpdatedAt: string
}
