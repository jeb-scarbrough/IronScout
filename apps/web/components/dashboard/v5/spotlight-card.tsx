'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { SpotlightData, SignalAge } from './types'

interface SpotlightCardProps {
  data: SpotlightData
  className?: string
}

/**
 * SpotlightCard - Dashboard v5
 *
 * Single synthesized signal for opportunist users.
 * Shows the largest change since last visit.
 *
 * Per ADR-020:
 * - Factual language only
 * - No "deal", "best", "worth it"
 * - Badge decay based on signal age
 */
export function SpotlightCard({ data, className }: SpotlightCardProps) {
  const {
    productId,
    productName,
    attributes,
    pricePerRound,
    retailerName,
    signalType,
    signalAge,
    changePercent,
    previousPrice,
  } = data

  // Meta text based on signal type
  const getMetaText = () => {
    switch (signalType) {
      case 'largest-price-movement':
        return 'Largest price movement since your last visit'
      case 'back-in-stock-watched':
        return 'Item you\'re watching is back in stock'
      case 'lowest-90-days':
        return 'Lowest price observed in 90 days'
      default:
        return 'Notable change'
    }
  }

  // Context line (factual explanation)
  const getContextLine = () => {
    if (signalType === 'largest-price-movement' && changePercent && previousPrice) {
      const direction = changePercent < 0 ? 'dropped' : 'increased'
      return `Price ${direction} ${Math.abs(changePercent).toFixed(0)}% from $${previousPrice.toFixed(2)}/rd`
    }
    if (signalType === 'back-in-stock-watched') {
      return 'Recently became available again'
    }
    if (signalType === 'lowest-90-days') {
      return 'Lowest price observed in the last 90 days'
    }
    return null
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-6 shadow-sm',
        className
      )}
    >
      {/* Badge */}
      <SignalBadge age={signalAge} />

      {/* Meta text */}
      <p className="text-sm text-muted-foreground mt-3">
        {getMetaText()}
      </p>

      {/* Product name */}
      <h3 className="text-xl font-semibold mt-2">
        {productName}
      </h3>

      {/* Attributes */}
      <p className="text-sm text-muted-foreground mt-1">
        {attributes}
      </p>

      {/* Price + retailer */}
      <p className="text-base mt-3">
        <span className="font-medium">${pricePerRound.toFixed(2)}/rd</span>
        <span className="text-muted-foreground"> at {retailerName}</span>
      </p>

      {/* Context line */}
      {getContextLine() && (
        <p className="text-sm text-muted-foreground mt-2">
          {getContextLine()}
        </p>
      )}

      {/* CTA */}
      <div className="mt-4 flex justify-end">
        <Link
          href={`/products/${productId}/history`}
          className="text-sm text-primary hover:underline"
        >
          View price history &rarr;
        </Link>
      </div>
    </div>
  )
}

/**
 * Signal age badge with decay styling
 */
function SignalBadge({ age }: { age: SignalAge }) {
  if (age === 'CLEARED') {
    // No badge for cleared signals
    return null
  }

  const isStale = age === 'STALE'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase',
        isStale
          ? 'bg-muted text-muted-foreground opacity-60'
          : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200'
      )}
    >
      {isStale ? 'Recent' : 'New'}
    </span>
  )
}
