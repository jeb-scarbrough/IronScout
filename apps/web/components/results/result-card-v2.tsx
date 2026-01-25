'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bookmark, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { trackAffiliateClick, trackTrackToggle } from '@/lib/analytics'
import { toast } from 'sonner'
import type { ResultCardV2Props, RetailerPrice } from './types'
import {
  formatPrice,
  formatShippingInfoShort,
  truncate,
  sortRetailers,
} from './types'

/** Maximum inline retailer rows before overflow */
const MAX_INLINE_RETAILERS = 3

/**
 * Get casing badge style - Brass gets warm accent, Steel gets neutral
 */
function getCasingStyle(casing: string): string {
  const lower = casing.toLowerCase()
  if (lower === 'brass') {
    return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
  }
  if (lower === 'steel') {
    return 'bg-muted text-muted-foreground border-border'
  }
  return 'bg-muted text-muted-foreground border-border'
}

/**
 * ResultCardV2 - Multi-retailer comparison card
 *
 * Per search-results-ux-spec.md:
 * - Inline retailer rows (max 3)
 * - Overflow triggers panel
 * - No isBestPrice, no badges, no timestamps
 * - Factual only, no recommendation language
 */
export function ResultCardV2({
  id,
  productTitle,
  caliber,
  bulletType,
  grainWeight,
  caseMaterial,
  roundCount,
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

  // Sort retailers by price (lowest first)
  const sortedRetailers = sortRetailers(retailers, 'price_asc')
  const inlineRetailers = sortedRetailers.slice(0, MAX_INLINE_RETAILERS)
  const overflowCount = retailers.length - MAX_INLINE_RETAILERS
  const hasOverflow = overflowCount > 0

  // Check stock status
  const anyInStock = retailers.some((r) => r.inStock)
  const allOutOfStock = retailers.length > 0 && !anyInStock

  const handleWatchToggle = useCallback(() => {
    const nextState = !watchingOptimistic
    setWatchingOptimistic(nextState)
    trackTrackToggle(id, nextState)

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

    onWatchToggle(id)
  }, [id, watchingOptimistic, onWatchToggle])

  const handleCompareClick = useCallback(() => {
    onCompareClick(id)
  }, [id, onCompareClick])

  const handleRetailerClick = useCallback(
    (retailer: RetailerPrice) => {
      trackAffiliateClick(id, retailer.retailerName, retailer.pricePerRound, 'card')
      window.open(retailer.url, '_blank', 'noopener,noreferrer')
    },
    [id]
  )

  // Empty state (no retailers)
  if (retailers.length === 0) {
    return (
      <Card className="overflow-hidden h-full flex flex-col border border-border bg-card">
        <CardContent className="p-4 flex flex-col flex-1">
          <WatchButton
            isWatched={watchingOptimistic}
            onClick={handleWatchToggle}
          />
          <ProductHeader
            productTitle={productTitle}
            caliber={caliber}
            bulletType={bulletType}
            grainWeight={grainWeight}
            caseMaterial={caseMaterial}
          />
          <div className="flex-1 flex items-center justify-center py-6">
            <div className="text-center">
              <p className="text-muted-foreground font-medium">No current listings</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Check back later</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full h-10"
            onClick={handleWatchToggle}
            disabled={watchingOptimistic}
          >
            {watchingOptimistic ? 'Watching' : 'Watch for availability'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Determine CTA text and behavior
  const singleRetailer = retailers.length === 1
  const ctaText = singleRetailer
    ? `View at ${truncate(retailers[0].retailerName, 20)}`
    : `Compare ${retailers.length} prices`

  return (
    <Card
      className={cn(
        'overflow-hidden h-full flex flex-col border bg-card',
        allOutOfStock ? 'opacity-70' : 'border-border hover:border-primary/30'
      )}
    >
      <CardContent className="p-4 flex flex-col flex-1">
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

        {/* Retailer Comparison Block */}
        <div className="mt-3 space-y-1.5">
          {inlineRetailers.map((retailer) => (
            <InlineRetailerRow
              key={retailer.retailerId}
              retailer={retailer}
              onClick={() => handleRetailerClick(retailer)}
            />
          ))}

          {/* Overflow link */}
          {hasOverflow && (
            <button
              onClick={handleCompareClick}
              className="w-full text-left text-sm text-primary hover:underline underline-offset-4 py-1"
            >
              {overflowCount <= 2 ? `+${overflowCount} more` : `Compare all ${retailers.length}`}
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <div className="mt-4">
          <Button
            variant="outline"
            className="w-full h-10"
            onClick={singleRetailer ? () => handleRetailerClick(retailers[0]) : handleCompareClick}
          >
            <span className="truncate">{ctaText}</span>
            <ArrowUpRight className="ml-2 h-4 w-4 shrink-0" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
  onClick: () => void
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

/**
 * Product header - title and attributes
 */
function ProductHeader({
  productTitle,
  caliber,
  bulletType,
  grainWeight,
  caseMaterial,
}: {
  productTitle: string
  caliber: string
  bulletType?: string
  grainWeight?: number
  caseMaterial?: string
}) {
  return (
    <>
      <h3 className="font-semibold text-foreground leading-tight pr-20 mb-2 line-clamp-2">
        {productTitle}
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {caliber && (
          <span className="px-2 py-0.5 text-xs font-medium rounded border bg-muted/50 text-foreground border-border">
            {caliber}
          </span>
        )}
        {bulletType && (
          <span className="px-2 py-0.5 text-xs font-medium rounded border bg-transparent text-muted-foreground border-border">
            {bulletType}
          </span>
        )}
        {grainWeight && (
          <span className="px-2 py-0.5 text-xs font-medium rounded border bg-transparent text-muted-foreground border-border">
            {grainWeight}gr
          </span>
        )}
        {caseMaterial && (
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded border',
              getCasingStyle(caseMaterial)
            )}
          >
            {caseMaterial}
          </span>
        )}
      </div>
    </>
  )
}

/**
 * Inline retailer row - compact display within card
 */
function InlineRetailerRow({
  retailer,
  onClick,
}: {
  retailer: RetailerPrice
  onClick: () => void
}) {
  const shippingText = formatShippingInfoShort(retailer.shippingInfo)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded border border-border/50 hover:border-border hover:bg-muted/30 transition-colors',
        !retailer.inStock && 'opacity-60'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm text-foreground truncate">
          {truncate(retailer.retailerName, 20)}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono font-bold text-sm">
            {formatPrice(retailer.pricePerRound)}/rd
          </span>
          <span className="text-xs text-muted-foreground">
            {formatPrice(retailer.totalPrice)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-xs">
        <span
          className={cn(
            'font-medium',
            retailer.inStock
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-500 dark:text-red-400'
          )}
        >
          {retailer.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
        {shippingText && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground">{shippingText}</span>
          </>
        )}
      </div>
    </button>
  )
}

/**
 * ResultCardV2Skeleton - Loading placeholder
 */
export function ResultCardV2Skeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden h-full flex flex-col">
      <CardContent className="p-4 space-y-3">
        {/* Title skeleton */}
        <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />

        {/* Attribute badges skeleton */}
        <div className="flex gap-1.5">
          <div className="h-5 w-12 bg-muted rounded animate-pulse" />
          <div className="h-5 w-10 bg-muted rounded animate-pulse" />
          <div className="h-5 w-14 bg-muted rounded animate-pulse" />
        </div>

        {/* Retailer rows skeleton */}
        <div className="space-y-1.5 mt-3">
          <div className="h-14 w-full bg-muted/50 rounded animate-pulse" />
          <div className="h-14 w-full bg-muted/50 rounded animate-pulse" />
          <div className="h-14 w-full bg-muted/50 rounded animate-pulse" />
        </div>

        {/* CTA skeleton */}
        <div className="h-10 w-full bg-muted rounded animate-pulse mt-auto" />
      </CardContent>
    </Card>
  )
}
