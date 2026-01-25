'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PriceChange {
  id: string
  productId: string
  productName: string
  direction: 'up' | 'down'
  pricePerRound: number
  source?: 'watchlist' | 'gun_locker'
  caliber?: string // for gun locker attribution
}

interface PriceMovementAccordionProps {
  changes: PriceChange[]
  className?: string
}

/**
 * PriceMovementAccordion - Dashboard v5
 *
 * Per v5-patch-001:
 * - NOT a vertical feed
 * - Collapsed by default
 * - Max 3 items visible after expansion
 * - No "PRICE DROP" labels
 * - Directional arrows only (↓ ↑)
 * - No percent displayed inline
 */
export function PriceMovementAccordion({
  changes,
  className,
}: PriceMovementAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (changes.length === 0) {
    return null
  }

  const visibleChanges = isExpanded ? changes.slice(0, 3) : []
  const remainingCount = Math.max(0, changes.length - 3)

  return (
    <div className={cn('border-t border-border/30', className)}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between py-3 px-2',
          'text-sm text-muted-foreground',
          'hover:text-foreground transition-colors',
          'focus:outline-none focus:ring-1 focus:ring-ring rounded-sm'
        )}
        aria-expanded={isExpanded}
      >
        <span>
          {changes.length} price {changes.length === 1 ? 'change' : 'changes'}{' '}
          in the last 24 hours
        </span>
        <ChevronRight
          className={cn(
            'h-4 w-4 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="pb-3 space-y-1">
          {visibleChanges.map((change) => (
            <PriceChangeRow key={change.id} change={change} />
          ))}

          {remainingCount > 0 && (
            <button
              className="w-full py-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Could expand to show all, or navigate to full view
              }}
            >
              Show {remainingCount} more
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Individual price change row
 */
function PriceChangeRow({ change }: { change: PriceChange }) {
  const DirectionIcon = change.direction === 'down' ? ArrowDown : ArrowUp

  return (
    <Link
      href={`/products/${change.productId}`}
      className={cn(
        'flex items-center h-10 px-2 rounded-sm',
        'hover:bg-muted/30 transition-colors',
        'text-sm'
      )}
    >
      {/* Direction arrow */}
      <DirectionIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      {/* Product name */}
      <span className="ml-3 truncate flex-1 text-foreground">
        {change.productName}
      </span>

      {/* Gun locker attribution */}
      {change.source === 'gun_locker' && change.caliber && (
        <span className="ml-2 text-xs text-muted-foreground flex-shrink-0">
          Matches {change.caliber}
        </span>
      )}

      {/* Price */}
      <span className="ml-3 text-muted-foreground flex-shrink-0">
        ${change.pricePerRound.toFixed(2)}/rd
      </span>

      {/* Navigate indicator */}
      <ChevronRight className="ml-2 h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
    </Link>
  )
}
