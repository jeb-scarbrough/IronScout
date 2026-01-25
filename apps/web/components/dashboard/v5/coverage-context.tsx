'use client'

import { cn } from '@/lib/utils'

export type CoverageObservationType =
  | 'retailers'
  | 'products'
  | 'coverage'
  | 'availability'
  | 'calibers'
  | 'freshness'

export interface CoverageObservation {
  type: CoverageObservationType
  copy: string
}

interface CoverageContextProps {
  observation: CoverageObservation | null
  stockSummary?: {
    inStock: number
    total: number
  }
  className?: string
}

/**
 * CoverageContext - Ambient Vitality Footer
 *
 * Per dashboard-v5-ambient-vitality.md:
 * - Rotating factual observations about monitoring scope
 * - Different content each visit to reward returning
 * - Purely factual, no implications
 * - Always includes stock summary when available
 */
export function CoverageContext({
  observation,
  stockSummary,
  className,
}: CoverageContextProps) {
  if (!observation && !stockSummary) {
    return null
  }

  return (
    <footer className={cn('py-4 border-t border-border/30', className)}>
      <p className="text-xs text-muted-foreground text-center">
        {observation?.copy}
        {observation && stockSummary && ' · '}
        {stockSummary && (
          <span>
            {stockSummary.inStock}/{stockSummary.total} items in stock
          </span>
        )}
      </p>
    </footer>
  )
}

/**
 * Generate coverage observation based on available data
 *
 * Observations are:
 * - Factual, not prescriptive
 * - Scope-focused, not deal-focused
 * - Varied to reward repeat visits
 */
export function generateCoverageObservation(
  data: {
    retailerCount?: number
    productCount?: number
    caliberCount?: number
    statesCount?: number
    availabilityChange?: number // percent vs last week
    lastUpdateTime?: Date
  },
  dayOfWeek?: number
): CoverageObservation | null {
  const observations: CoverageObservation[] = []

  // Retailer coverage
  if (data.retailerCount && data.retailerCount > 10) {
    observations.push({
      type: 'retailers',
      copy: `Prices checked across ${data.retailerCount} retailers`,
    })

    if (data.statesCount && data.statesCount > 10) {
      observations.push({
        type: 'coverage',
        copy: `Coverage: ${data.retailerCount} retailers across ${data.statesCount} states`,
      })
    }
  }

  // Product tracking
  if (data.productCount && data.productCount > 50) {
    observations.push({
      type: 'products',
      copy: `Tracking ${data.productCount} products matching your calibers`,
    })
  }

  // Caliber diversity
  if (data.caliberCount && data.caliberCount > 2) {
    observations.push({
      type: 'calibers',
      copy: `Your tracked items span ${data.caliberCount} calibers`,
    })
  }

  // Availability change
  if (data.availabilityChange !== undefined && Math.abs(data.availabilityChange) >= 5) {
    const direction = data.availabilityChange > 0 ? 'improved' : 'decreased'
    observations.push({
      type: 'availability',
      copy: `Availability ${direction} ${Math.abs(data.availabilityChange)}% this week`,
    })
  }

  // Freshness
  if (data.lastUpdateTime) {
    const hoursAgo = Math.floor(
      (Date.now() - data.lastUpdateTime.getTime()) / (1000 * 60 * 60)
    )
    if (hoursAgo < 1) {
      observations.push({
        type: 'freshness',
        copy: 'All prices verified within the last hour',
      })
    }
  }

  if (observations.length === 0) {
    return null
  }

  // Select based on day of week for consistent daily rotation
  const day = dayOfWeek ?? new Date().getDay()
  return observations[day % observations.length]
}

/**
 * Pre-defined observation templates for fallback
 */
export const COVERAGE_TEMPLATES: Record<CoverageObservationType, string[]> = {
  retailers: [
    'Prices checked across {count} retailers',
    'Monitoring {count} retailers for price changes',
  ],
  products: [
    'Tracking {count} products matching your calibers',
    '{count} products in your price monitoring queue',
  ],
  coverage: [
    'Coverage: {retailers} retailers across {states} states',
    'Monitoring prices from {states} states nationwide',
  ],
  availability: [
    'Availability {direction} {percent}% this week',
    'Stock levels {direction} across tracked items',
  ],
  calibers: [
    'Your tracked items span {count} calibers',
    'Monitoring {count} calibers based on your watchlist',
  ],
  freshness: [
    'All prices verified within the last hour',
    'Prices last checked {time} ago',
  ],
}
