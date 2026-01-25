'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SpotlightReason = '90d_low' | 'back_in_stock' | 'significant_drop'

interface SpotlightNoticeProps {
  productName: string
  productId: string
  reason: SpotlightReason
  percentChange?: number
  onDismiss?: () => void
  className?: string
}

/**
 * SpotlightNotice - Dashboard v5 (Per v5-patch-001)
 *
 * Single-line ephemeral notice, NOT a hero card.
 *
 * Constraints:
 * - Max height: 40px
 * - No card, shadow, or border emphasis
 * - No price, no percent (except in template)
 * - Dismissible
 * - Not visually dominant
 */
export function SpotlightNotice({
  productName,
  productId,
  reason,
  percentChange,
  onDismiss,
  className,
}: SpotlightNoticeProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) {
    return null
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDismissed(true)
    onDismiss?.()
  }

  const copyText = getCopyText(reason, productName, percentChange)

  return (
    <Link
      href={`/products/${productId}`}
      className={cn(
        'flex items-center h-10 px-4 rounded-md bg-muted/50',
        'hover:bg-muted/70 transition-colors',
        'group',
        className
      )}
    >
      <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="ml-3 text-sm text-foreground truncate flex-1">
        {copyText}
      </span>
      <button
        onClick={handleDismiss}
        className={cn(
          'ml-3 p-1 rounded-sm flex-shrink-0',
          'text-muted-foreground hover:text-foreground',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          'focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring'
        )}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </Link>
  )
}

function getCopyText(
  reason: SpotlightReason,
  productName: string,
  percentChange?: number
): string {
  switch (reason) {
    case '90d_low':
      return `${productName} is at its lowest price in 90 days`
    case 'back_in_stock':
      return `${productName} is back in stock`
    case 'significant_drop':
      if (percentChange !== undefined) {
        return `${productName} dropped ${Math.abs(percentChange)}% since last week`
      }
      return `${productName} dropped significantly`
    default:
      return `${productName} has a notable change`
  }
}
