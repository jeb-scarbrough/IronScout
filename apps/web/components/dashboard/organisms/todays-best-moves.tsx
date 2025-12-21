'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContextChip } from '../atoms/context-chip'
import { PriceDelta } from '../atoms/price-delta'
import { ExternalLink, Sparkles } from 'lucide-react'
import { useDealsForYou } from '@/hooks/use-deals-for-you'
import { useMarketPulse } from '@/hooks/use-market-pulse'
import { UPGRADE_COPY } from '@/types/dashboard'
import type { ProductFeedItem, PriceContext } from '@/types/dashboard'

interface TopMatchProps {
  isPremium?: boolean
}

/**
 * TopMatch - Hero section showing top personalized match (ADR-006 compliant)
 *
 * Trading terminal-style hero showing a product that matches
 * the user's tracked calibers and preferences.
 *
 * Uses price context (descriptive) instead of verdicts (prescriptive).
 */
export function TopMatch({ isPremium = false }: TopMatchProps) {
  const { data: itemsData, loading: itemsLoading } = useDealsForYou()
  const { data: pulseData, loading: pulseLoading } = useMarketPulse()

  const loading = itemsLoading || pulseLoading

  // Get top item from personalized feed
  const topItem = itemsData?.items?.[0]

  // Find market pulse context for the top item's caliber
  const getPriceContextForItem = (item: ProductFeedItem): PriceContext => {
    if (!pulseData?.pulse) return 'INSUFFICIENT_DATA'
    const caliber = item.product.caliber
    const pulse = pulseData.pulse.find((p) => p.caliber === caliber)
    return pulse?.priceContext || 'INSUFFICIENT_DATA'
  }

  const priceContext = topItem ? getPriceContextForItem(topItem) : 'INSUFFICIENT_DATA'
  const pulse = topItem
    ? pulseData?.pulse?.find((p) => p.caliber === topItem.product.caliber)
    : null

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border overflow-hidden">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-32" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <div className="flex-shrink-0">
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!topItem) {
    return (
      <Card className="bg-gradient-to-br from-card to-card/80 border-border overflow-hidden">
        <CardContent className="p-6 md:p-8 text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-semibold">No Matches Yet</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Set up alerts and track products to see personalized matches.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleViewClick = () => {
    window.open(topItem.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border overflow-hidden">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left side: Context + Product info */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Price context chip */}
            <ContextChip context={priceContext} size="lg" />

            {/* Product name */}
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                {topItem.product.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {topItem.product.caliber}
                {topItem.product.grainWeight && ` • ${topItem.product.grainWeight}gr`}
                {' • '}
                {topItem.retailer.name}
              </p>
            </div>

            {/* Price info */}
            <div className="flex flex-wrap items-center gap-4">
              {topItem.pricePerRound !== null && (
                <div className="text-2xl md:text-3xl font-bold text-foreground">
                  ${topItem.pricePerRound.toFixed(3)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    /rd
                  </span>
                </div>
              )}

              {/* Premium: Show delta */}
              {isPremium && pulse && (
                <div className="flex items-center gap-2">
                  <PriceDelta percent={pulse.trendPercent} size="md" />
                  <span className="text-xs text-muted-foreground">vs 7-day avg</span>
                </div>
              )}
            </div>

            {/* Free tier teaser */}
            {!isPremium && (
              <p className="text-xs text-muted-foreground italic">
                {UPGRADE_COPY.MARKET_PULSE_EXPAND}
              </p>
            )}
          </div>

          {/* Right side: CTA */}
          <div className="flex-shrink-0 lg:text-right">
            <Button
              onClick={handleViewClick}
              size="lg"
              className="w-full lg:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-8"
            >
              View at Retailer
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            {topItem.inStock && (
              <p className="mt-2 text-xs text-status-buy">In Stock</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Export with old name for backwards compatibility during migration
export { TopMatch as TodaysBestMoves }
