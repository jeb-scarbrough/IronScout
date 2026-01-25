'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { GunLockerMatchItem } from './types'

interface ContextRowProps {
  item: GunLockerMatchItem
  className?: string
}

/**
 * ContextRow - Dashboard v5
 *
 * Quiet, contextual row for Gun Locker matches.
 * No badges, no urgency. Just context explanation.
 *
 * Per spec:
 * - Context line required: "Matches [caliber] in your gun locker"
 * - Action: View details (informational)
 */
export function ContextRow({ item, className }: ContextRowProps) {
  const {
    productId,
    productName,
    attributes,
    pricePerRound,
    matchedCaliber,
  } = item

  return (
    <div
      className={cn(
        'py-4 border-b border-border/50',
        className
      )}
    >
      {/* Product name */}
      <p className="text-base font-medium">
        {productName}
      </p>

      {/* Attributes */}
      <p className="text-sm text-muted-foreground">
        {attributes}
      </p>

      {/* Context explanation */}
      <p className="text-xs text-muted-foreground/80 mt-1">
        Matches {matchedCaliber} in your gun locker
      </p>

      {/* Price + CTA */}
      <div className="flex items-baseline justify-between mt-2">
        <span className="text-sm font-medium">
          ${pricePerRound.toFixed(2)}/rd
        </span>

        <Link
          href={`/products/${productId}`}
          className="text-sm text-primary hover:underline"
        >
          View details
        </Link>
      </div>
    </div>
  )
}
