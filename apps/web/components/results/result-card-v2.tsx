'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Bookmark, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { trackTrackToggle } from '@/lib/analytics'
import { toast } from 'sonner'
import type { ResultCardV2Props, RetailerPrice } from './types'
import { formatPrice, formatShippingInfo } from './types'
import { BADGE_CONFIG } from '@/lib/api'
import type { PerformanceBadge } from '@/lib/api'

/** Max retailer rows to show inline */
const MAX_INLINE_RETAILERS = 3



/**
 * Format estimated total price for display
 */
function formatEstTotal(retailer: RetailerPrice, roundCount?: number): string | null {
  if (!roundCount || roundCount <= 1) return null
  const total = retailer.totalPrice
  // Show range if shipping unknown
  if (retailer.shippingInfo.type === 'unknown' || retailer.shippingInfo.type === 'excluded_unknown') {
    const minTotal = total
    const maxTotal = total + 20 // Estimate max shipping
    return `Est. total: $${minTotal.toFixed(0)}–$${maxTotal.toFixed(0)}`
  }
  if (retailer.shippingInfo.type === 'included') {
    return `Est. total: $${total.toFixed(0)}`
  }
  if (retailer.shippingInfo.type === 'excluded') {
    const withShipping = total + retailer.shippingInfo.amount
    return `Est. total: $${withShipping.toFixed(0)}`
  }
  return null
}

/**
 * Get shipping display text
 */
function getShippingText(retailer: RetailerPrice): string | null {
  const info = retailer.shippingInfo
  switch (info.type) {
    case 'included':
      return 'Includes shipping'
    case 'excluded':
      return `+$${info.amount.toFixed(0)} shipping`
    case 'excluded_unknown':
      return '+ shipping (varies)'
    case 'free_over':
      return `Free shipping over $${info.threshold}`
    case 'pickup_only':
      return 'Pickup only'
    case 'unknown':
      return '+ shipping (varies)'
  }
}

/**
 * ResultCardV2 - Product card with inline retailer prices
 *
 * Shows product info, top 3 retailer prices inline,
 * and "View retailer prices >" link to open full panel.
 */
export function ResultCardV2({
  id,
  productTitle,
  caliber,
  brand,
  bulletType,
  grainWeight,
  caseMaterial,
  roundCount,
  badges,
  retailers,
  isWatched,
  onWatchToggle,
  onCompareClick,
}: ResultCardV2Props) {
  const [watchingOptimistic, setWatchingOptimistic] = useState(isWatched)

  // Sync optimistic state with prop changes
  useEffect(() => {
    setWatchingOptimistic(isWatched)
  }, [isWatched])

  // Sort retailers by price (in-stock first, then by price)
  const sortedRetailers = useMemo(() => {
    const inStock = retailers.filter((r) => r.inStock).sort((a, b) => a.pricePerRound - b.pricePerRound)
    const outOfStock = retailers.filter((r) => !r.inStock).sort((a, b) => a.pricePerRound - b.pricePerRound)
    return [...inStock, ...outOfStock]
  }, [retailers])

  // Get top retailers for inline display
  const inlineRetailers = sortedRetailers.slice(0, MAX_INLINE_RETAILERS)
  const hasMoreRetailers = retailers.length > MAX_INLINE_RETAILERS
  const anyInStock = retailers.some((r) => r.inStock)

  const handleWatchToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation() // Don't trigger card click
      const nextState = !watchingOptimistic

      // Optimistically update UI
      setWatchingOptimistic(nextState)
      trackTrackToggle(id, nextState)

      // Await parent handler — it handles auth checks and API calls
      const success = await onWatchToggle(id)

      if (success) {
        if (nextState) {
          toast.success('Added to watchlist', {
            description: "We'll notify you when the price drops.",
            action: {
              label: 'View Watchlist',
              onClick: () => (window.location.href = '/dashboard/saved'),
            },
            duration: 4000,
          })
        } else {
          toast.success('Removed from watchlist', { duration: 2000 })
        }
      } else {
        // Revert optimistic state on failure
        setWatchingOptimistic(!nextState)
      }
    },
    [id, watchingOptimistic, onWatchToggle]
  )

  const handleViewPrices = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onCompareClick(id)
    },
    [id, onCompareClick]
  )

  // Empty state (no retailers)
  if (retailers.length === 0) {
    return (
      <Card className="overflow-hidden h-full flex flex-col border border-border bg-card">
        <CardContent className="p-4 flex flex-col flex-1 relative">
          <WatchButton
            isWatched={watchingOptimistic}
            onClick={handleWatchToggle}
          />
          <ProductHeader
            productTitle={productTitle}
            caliber={caliber}
            brand={brand}
            bulletType={bulletType}
            grainWeight={grainWeight}
            caseMaterial={caseMaterial}
            roundCount={roundCount}
            badges={badges}
          />
          <div className="flex-1 flex items-center justify-center py-6">
            <div className="text-center">
              <p className="text-muted-foreground font-medium">No current listings</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Check back later</p>
            </div>
          </div>
          <button
            onClick={handleWatchToggle}
            disabled={watchingOptimistic}
            className={cn(
              'w-full h-10 rounded-md border text-sm font-medium transition-colors',
              watchingOptimistic
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'border-border hover:bg-muted'
            )}
          >
            {watchingOptimistic ? 'Watching' : 'Watch for availability'}
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'overflow-hidden h-full flex flex-col border bg-card transition-all',
        anyInStock
          ? 'border-border hover:border-primary/40 hover:shadow-sm'
          : 'opacity-70 border-border'
      )}
    >
      <CardContent className="p-4 flex flex-col flex-1 relative">
        {/* Watch Button */}
        <WatchButton isWatched={watchingOptimistic} onClick={handleWatchToggle} />

        {/* Product Header */}
        <ProductHeader
          productTitle={productTitle}
          caliber={caliber}
          bulletType={bulletType}
          grainWeight={grainWeight}
          caseMaterial={caseMaterial}
        />

        {/* Retailer Prices */}
        <div className="mt-4 flex-1">
          {/* Retailer Rows */}
          <div className="space-y-3">
            {inlineRetailers.map((retailer, index) => (
              <RetailerRow
                key={`${retailer.retailerId}-${index}`}
                retailer={retailer}
                roundCount={roundCount}
              />
            ))}

            {/* "No other retailers" message if only showing few */}
            {retailers.length <= MAX_INLINE_RETAILERS && retailers.length < 3 && (
              <p className="text-xs text-muted-foreground/60 italic">
                No other retailers found
              </p>
            )}
          </div>
        </div>

        {/* Footer: View retailer prices link */}
        <button
          onClick={handleViewPrices}
          className="mt-4 pt-3 border-t border-border/50 flex items-center justify-end w-full text-sm text-primary hover:text-primary/80 transition-colors"
        >
          View retailer prices
          <ChevronRight className="h-4 w-4 ml-0.5" />
        </button>
      </CardContent>
    </Card>
  )
}

/**
 * Single retailer price row
 */
function RetailerRow({
  retailer,
  roundCount,
}: {
  retailer: RetailerPrice
  roundCount?: number
}) {
  const shippingText = getShippingText(retailer)
  const estTotal = formatEstTotal(retailer, roundCount)

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-foreground truncate block">
          {retailer.retailerName}
        </span>
        {/* Shipping or est total info */}
        {(shippingText || estTotal) && (
          <span className="text-xs text-muted-foreground">
            {estTotal || shippingText}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 shrink-0">
        <span className={cn(
          'text-sm font-bold font-mono',
          retailer.inStock ? 'text-primary' : 'text-muted-foreground'
        )}>
          {formatPrice(retailer.pricePerRound)}
        </span>
        <span className="text-xs text-muted-foreground">/ rd</span>
        {!retailer.inStock && (
          <span className="text-xs font-medium text-destructive ml-1">OOS</span>
        )}
      </div>
    </div>
  )
}

/**
 * Watch button - top right corner
 */
function WatchButton({
  isWatched,
  onClick,
}: {
  isWatched: boolean
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors z-10',
              isWatched
                ? 'text-primary bg-primary/10 hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Bookmark className={cn('h-3.5 w-3.5', isWatched && 'fill-current')} />
            <span>{isWatched ? 'Watching' : 'Watch'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">
            {isWatched ? 'Click to remove from watchlist' : 'Get alerts when price drops'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Max performance badges to show inline */
const MAX_INLINE_BADGES = 2

/**
 * Product header - brand, title, attribute chips, and performance badges
 */
function ProductHeader({
  productTitle,
  caliber,
  brand,
  bulletType,
  grainWeight,
  caseMaterial,
  roundCount,
  badges,
}: {
  productTitle: string
  caliber: string
  brand?: string
  bulletType?: string
  grainWeight?: number
  caseMaterial?: string
  roundCount?: number
  badges?: string[]
}) {
  // Build attribute chips: caliber · grain · bullet type · case material · round count
  const attrs = [
    caliber,
    grainWeight ? `${grainWeight}gr` : null,
    bulletType,
    caseMaterial,
  ].filter(Boolean)

  // Get badge configs for display (limit to MAX_INLINE_BADGES)
  const displayBadges = (badges || [])
    .slice(0, MAX_INLINE_BADGES)
    .map((b) => BADGE_CONFIG[b as PerformanceBadge])
    .filter(Boolean)

  return (
    <>
      {/* Brand name */}
      {brand && (
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
          {brand}
        </p>
      )}
      <h3 className="font-semibold text-foreground leading-tight pr-20 mb-1 line-clamp-2">
        {productTitle}
      </h3>
      {/* Attribute line: caliber · grain · bullet type · case material */}
      {attrs.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-sm text-muted-foreground">
          <span>{attrs.join(' \u00b7 ')}</span>
          {/* Round count — visually distinct */}
          {roundCount && roundCount > 1 && (
            <>
              <span className="text-muted-foreground/40">\u00b7</span>
              <span className="font-medium text-foreground/70">
                {roundCount.toLocaleString()} rds
              </span>
            </>
          )}
        </div>
      )}
      {/* Performance badges */}
      {displayBadges.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {displayBadges.map((badge) => (
            <span
              key={badge.label}
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none',
                badge.color
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * ResultCardV2Skeleton - Loading placeholder
 */
export function ResultCardV2Skeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden h-full flex flex-col">
      <CardContent className="p-4 flex flex-col flex-1">
        {/* Title skeleton */}
        <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />

        {/* Attribute line skeleton */}
        <div className="h-4 w-40 bg-muted/60 rounded animate-pulse mt-1" />

        {/* Retailer rows skeleton */}
        <div className="space-y-3 flex-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex justify-between">
              <div className="space-y-1">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-3 w-20 bg-muted/50 rounded animate-pulse" />
              </div>
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Footer skeleton */}
        <div className="mt-4 pt-3 border-t border-border/50 flex justify-end">
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
