'use client'

import { cn } from '@/lib/utils'

export type MarketObservationType = 'caliber_trend' | 'availability' | 'coverage'

export interface MarketObservation {
  id: string
  type: MarketObservationType
  copy: string
}

interface MarketContextProps {
  observation: MarketObservation | null
  stockSummary?: {
    inStock: number
    total: number
  }
  className?: string
}

/**
 * MarketContext - Dashboard v5 Vitality Footer
 *
 * Per v5-patch-001 Section 8:
 * - Single factual observation about broader market
 * - Below Watchlist, not above
 * - Muted styling
 * - MUST NOT reference specific products
 * - MUST NOT imply action
 * - Rotates to reward repeat visits
 */
export function MarketContext({
  observation,
  stockSummary,
  className,
}: MarketContextProps) {
  // If no observation, show stock summary only (if available)
  if (!observation && !stockSummary) {
    return null
  }

  return (
    <div className={cn('py-4 text-center', className)}>
      <p className="text-xs text-muted-foreground">
        {observation?.copy}
        {observation && stockSummary && ' · '}
        {stockSummary && (
          <span>
            {stockSummary.inStock}/{stockSummary.total} in stock
          </span>
        )}
      </p>
    </div>
  )
}

/**
 * Generate a market observation based on available data
 *
 * Observations should be:
 * - Factual, not prescriptive
 * - General, not product-specific
 * - Varied to reward repeat visits
 */
export function generateMarketObservation(
  data: {
    calibers?: { caliber: string; avgPrice: number; median30d: number }[]
    retailerCount?: number
    totalProducts?: number
  },
  previousObservationType?: MarketObservationType
): MarketObservation | null {
  const observations: MarketObservation[] = []

  // Caliber trend observations
  if (data.calibers) {
    for (const cal of data.calibers) {
      const pctDiff = ((cal.avgPrice - cal.median30d) / cal.median30d) * 100
      if (Math.abs(pctDiff) >= 5) {
        const direction = pctDiff < 0 ? 'below' : 'above'
        observations.push({
          id: `trend-${cal.caliber}`,
          type: 'caliber_trend',
          copy: `${cal.caliber} prices are ${Math.abs(pctDiff).toFixed(0)}% ${direction} the 30-day average`,
        })
      }
    }
  }

  // Coverage observation
  if (data.retailerCount && data.retailerCount > 20) {
    observations.push({
      id: 'coverage',
      type: 'coverage',
      copy: `Monitoring prices from ${data.retailerCount} retailers`,
    })
  }

  // Availability observation
  if (data.totalProducts && data.totalProducts > 100) {
    observations.push({
      id: 'availability',
      type: 'availability',
      copy: `Tracking ${data.totalProducts} products across all calibers`,
    })
  }

  if (observations.length === 0) {
    return null
  }

  // Prefer variety: don't repeat same type consecutively
  const filtered = previousObservationType
    ? observations.filter((o) => o.type !== previousObservationType)
    : observations

  const pool = filtered.length > 0 ? filtered : observations

  // Random selection for variety
  return pool[Math.floor(Math.random() * pool.length)]
}
