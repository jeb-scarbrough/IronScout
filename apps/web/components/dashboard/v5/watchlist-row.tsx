'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { WatchlistItem, WatchlistStatus } from './types'

interface WatchlistRowProps {
  item: WatchlistItem
  className?: string
}

/**
 * WatchlistRow - Dashboard v5
 *
 * Calm, status-oriented row for watchlist items.
 * No badges. Status conveyed through text only.
 *
 * Per spec:
 * - No "no change" text (absence of status = nothing to report)
 * - Status line only if meaningful
 */
export function WatchlistRow({ item, className }: WatchlistRowProps) {
  const {
    productId,
    productName,
    attributes,
    pricePerRound,
    status,
  } = item

  return (
    <Link
      href={`/products/${productId}`}
      className={cn(
        'flex items-baseline justify-between py-4 border-b border-border/50 hover:bg-muted/30 transition-colors -mx-2 px-2 rounded-sm',
        className
      )}
    >
      <div className="flex-1 min-w-0">
        {/* Product name */}
        <p className="text-base font-medium truncate">
          {productName}
        </p>

        {/* Attributes */}
        <p className="text-sm text-muted-foreground truncate">
          {attributes}
        </p>

        {/* Status line (only if meaningful) */}
        {status && (
          <p className="text-xs text-muted-foreground/80 mt-1">
            {getStatusText(status)}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="ml-4 text-right flex-shrink-0">
        {pricePerRound !== null ? (
          <span className="text-base font-semibold">
            ${pricePerRound.toFixed(2)}/rd
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            No price
          </span>
        )}
      </div>
    </Link>
  )
}

/**
 * Get factual status text
 */
function getStatusText(status: WatchlistStatus): string | null {
  switch (status) {
    case 'lowest-90-days':
      return 'Lowest price observed in last 90 days'
    case 'price-moved':
      return 'Price moved since last check'
    case 'back-in-stock':
      return 'Back in stock'
    default:
      return null
  }
}
