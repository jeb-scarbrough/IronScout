'use client'

import { TrendingDown, PackageCheck, ArrowDownRight, Activity, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatTimeAgo } from '@/lib/utils'
import type { MarketDeal, MarketDealsSection } from '@/lib/api'

// ============================================================================
// TYPES
// ============================================================================

interface NotableMovesCardProps {
  sections: MarketDealsSection[]
  hero: MarketDeal | null
  lastCheckedAt: string
  personalized: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * NotableMovesCard — Surfaces market-wide notable price events on the dashboard.
 *
 * Shows personalized "Fits Your Gun Locker" section when the user has
 * firearms configured, plus a generic "Other Notable Price Moves" section.
 * Renders nothing when there are no deals.
 */
export function NotableMovesCard({
  sections,
  hero,
  lastCheckedAt,
  personalized,
}: NotableMovesCardProps) {
  // Filter out empty sections
  const nonEmptySections = sections.filter((s) => s.deals.length > 0)

  if (nonEmptySections.length === 0 && !hero) return null

  const totalDeals = nonEmptySections.reduce((sum, s) => sum + s.deals.length, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Activity className="h-4 w-4" />
            Notable Moves
          </CardTitle>
          <div className="flex items-center gap-2">
            {personalized && (
              <Badge variant="outline" className="text-xs font-normal">
                Personalized
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {totalDeals} {totalDeals === 1 ? 'deal' : 'deals'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Hero deal — highlighted at the top */}
          {hero && <HeroDealRow deal={hero} />}

          {/* Sections */}
          {nonEmptySections.map((section) => (
            <div key={section.title}>
              {nonEmptySections.length > 1 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {section.title}
                </p>
              )}
              <div className="space-y-2">
                {section.deals
                  .filter((d) => !hero || d.productId !== hero.productId)
                  .slice(0, 4)
                  .map((deal) => (
                    <DealRow key={`${deal.productId}-${deal.retailerId}`} deal={deal} />
                  ))}
              </div>
            </div>
          ))}

          {/* Last checked timestamp */}
          {lastCheckedAt && (
            <p className="text-xs text-muted-foreground/60 text-right">
              Updated {formatTimeAgo(new Date(lastCheckedAt))}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// HERO DEAL ROW
// ============================================================================

function HeroDealRow({ deal }: { deal: MarketDeal }) {
  const Icon = REASON_ICONS[deal.reason]
  const colorClass = REASON_COLORS[deal.reason]

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border-2 border-primary/20 bg-primary/[0.03]">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{deal.productName}</p>
          <Badge variant="secondary" className="text-xs shrink-0">
            {deal.caliber}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{deal.contextLine}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          {deal.retailerName}
          {deal.pricePerRound != null && (
            <> &middot; <span className="font-mono">${deal.pricePerRound.toFixed(2)}/rd</span></>
          )}
        </p>
      </div>

      <div className="shrink-0">
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <a
            href={deal.out_url || deal.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// DEAL ROW
// ============================================================================

function DealRow({ deal }: { deal: MarketDeal }) {
  const Icon = REASON_ICONS[deal.reason]
  const colorClass = REASON_COLORS[deal.reason]

  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border bg-card">
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          colorClass
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{deal.productName}</p>
          <Badge variant="outline" className="text-xs shrink-0 px-1.5 py-0">
            {deal.caliber}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {deal.retailerName}
          {deal.pricePerRound != null && (
            <> &middot; <span className="font-mono">${deal.pricePerRound.toFixed(2)}/rd</span></>
          )}
          {' '}&middot; {deal.contextLine}
        </p>
      </div>

      <div className="shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-3"
          asChild
        >
          <a
            href={deal.out_url || deal.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${deal.productName} deal`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// CONFIG
// ============================================================================

const REASON_ICONS: Record<string, typeof TrendingDown> = {
  'PRICE_DROP': TrendingDown,
  'BACK_IN_STOCK': PackageCheck,
  'LOWEST_90D': ArrowDownRight,
}

const REASON_COLORS: Record<string, string> = {
  'PRICE_DROP': 'bg-amber-500/10 text-amber-500',
  'BACK_IN_STOCK': 'bg-blue-500/10 text-blue-500',
  'LOWEST_90D': 'bg-emerald-500/10 text-emerald-500',
}

export default NotableMovesCard
