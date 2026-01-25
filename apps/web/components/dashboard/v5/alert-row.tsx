'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { AlertItem, BadgeType, SignalAge } from './types'

interface AlertRowProps {
  item: AlertItem
  className?: string
}

/**
 * AlertRow - Dashboard v5
 *
 * Interruptive row for price movements and back-in-stock events.
 * Includes badge (with decay), explanation, and price.
 *
 * Per spec:
 * - Badge for ACTIVE/STALE only (not CLEARED)
 * - Factual explanation line
 * - Action: View price history (informational, not transactional)
 */
export function AlertRow({ item, className }: AlertRowProps) {
  const {
    productId,
    productName,
    retailerName,
    pricePerRound,
    badgeType,
    signalAge,
    explanation,
  } = item

  return (
    <div
      className={cn(
        'py-4 border-b border-border/50',
        className
      )}
    >
      {/* Badge */}
      <AlertBadge type={badgeType} age={signalAge} />

      {/* Product name */}
      <p className="text-base font-medium mt-2">
        {productName}
      </p>

      {/* Explanation */}
      <p className="text-sm text-muted-foreground mt-1">
        {explanation}
      </p>

      {/* Price + retailer + CTA */}
      <div className="flex items-baseline justify-between mt-2">
        <p className="text-sm">
          <span className="font-medium">${pricePerRound.toFixed(2)}/rd</span>
          <span className="text-muted-foreground"> at {retailerName}</span>
        </p>

        <Link
          href={`/products/${productId}/history`}
          className="text-sm text-primary hover:underline"
        >
          View price history
        </Link>
      </div>
    </div>
  )
}

/**
 * Alert badge with type-specific styling and decay
 */
function AlertBadge({ type, age }: { type: BadgeType; age: SignalAge }) {
  // No badge for cleared signals
  if (age === 'CLEARED') {
    return null
  }

  const isStale = age === 'STALE'

  // Badge styling by type
  const getBadgeStyles = () => {
    const baseStyles = 'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase'

    if (isStale) {
      return cn(baseStyles, 'bg-muted text-muted-foreground opacity-60')
    }

    switch (type) {
      case '90-day-low':
        return cn(baseStyles, 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200')
      case 'price-drop':
        return cn(baseStyles, 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200')
      case 'back-in-stock':
        return cn(baseStyles, 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-200')
      default:
        return cn(baseStyles, 'bg-muted text-muted-foreground')
    }
  }

  // Badge label by type
  const getBadgeLabel = () => {
    switch (type) {
      case '90-day-low':
        return '90-Day Low'
      case 'price-drop':
        return 'Price Drop'
      case 'back-in-stock':
        return 'Available'
      default:
        return 'Update'
    }
  }

  return (
    <span className={getBadgeStyles()}>
      {getBadgeLabel()}
    </span>
  )
}
