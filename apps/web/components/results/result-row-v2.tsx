'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bookmark, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { trackTrackToggle } from '@/lib/analytics'
import { toast } from 'sonner'
import type { ResultRowV2Props } from './types'
import { formatPrice, truncate } from './types'
import { BADGE_CONFIG } from '@/lib/api'
import type { PerformanceBadge } from '@/lib/api'

/**
 * ResultRowV2 - Dense table row for grid view
 *
 * Per search-results-ux-spec.md:
 * - Shows retailer count, not single retailer
 * - lowestPricePerRound is the lowest in-stock price
 * - Compare button opens panel
 * - No recommendation language
 */
/** Max performance badges to show inline in grid */
const MAX_GRID_BADGES = 2

export function ResultRowV2({
  id,
  productTitle,
  caliber,
  brand,
  grainWeight,
  roundCount,
  badges,
  lowestPricePerRound,
  retailerCount,
  anyInStock,
  isWatched,
  onWatchToggle,
  onCompareClick,
}: ResultRowV2Props) {
  const [watchingOptimistic, setWatchingOptimistic] = useState(isWatched)

  useEffect(() => {
    setWatchingOptimistic(isWatched)
  }, [isWatched])

  const handleWatchToggle = useCallback(async () => {
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
  }, [id, watchingOptimistic, onWatchToggle])

  const handleCompareClick = useCallback(() => {
    onCompareClick(id)
  }, [id, onCompareClick])

  // Determine CTA text
  const ctaText = retailerCount === 1 ? 'View' : 'Compare'

  return (
    <tr
      className={cn(
        'border-b border-border hover:bg-muted/50 transition-colors',
        !anyInStock && 'opacity-60'
      )}
    >
      {/* Product */}
      <td className="py-3 px-4">
        <div className="flex flex-col gap-0.5">
          {/* Brand */}
          {brand && (
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-none">
              {brand}
            </span>
          )}
          {/* Title */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium text-foreground cursor-default leading-snug">
                  {truncate(productTitle, 50)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{productTitle}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Specs line: grain · round count + badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(grainWeight || (roundCount && roundCount > 1)) && (
              <span className="text-xs text-muted-foreground">
                {[
                  grainWeight ? `${grainWeight}gr` : null,
                  roundCount && roundCount > 1 ? `${roundCount.toLocaleString()} rds` : null,
                ].filter(Boolean).join(' \u00b7 ')}
              </span>
            )}
            {(badges || []).slice(0, MAX_GRID_BADGES).map((b) => {
              const config = BADGE_CONFIG[b as PerformanceBadge]
              if (!config) return null
              return (
                <span
                  key={b}
                  className={cn(
                    'inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold leading-none',
                    config.color
                  )}
                >
                  {config.label}
                </span>
              )
            })}
          </div>
        </div>
      </td>

      {/* Caliber */}
      <td className="py-3 px-4">
        <span className="px-2 py-0.5 text-xs font-medium rounded border bg-muted/50 text-foreground border-border">
          {caliber}
        </span>
      </td>

      {/* $/rd */}
      <td className="py-3 px-4 text-right">
        <span className="font-mono font-bold text-lg text-foreground">
          {formatPrice(lowestPricePerRound)}
        </span>
        <span className="text-xs text-muted-foreground ml-0.5">/rd</span>
      </td>

      {/* Retailers */}
      <td className="py-3 px-4">
        {retailerCount === 1 ? (
          <span className="text-sm text-muted-foreground">1 retailer</span>
        ) : (
          <button
            onClick={handleCompareClick}
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            {retailerCount} retailers
          </button>
        )}
      </td>

      {/* Stock */}
      <td className="py-3 px-4 text-center">
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-medium',
            anyInStock
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-red-400 text-red-500 dark:text-red-400'
          )}
        >
          {anyInStock ? 'In Stock' : 'Out'}
        </Badge>
      </td>

      {/* Watch */}
      <td className="py-3 px-4 text-center">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleWatchToggle}
                className={cn(
                  'p-1 rounded transition-colors',
                  watchingOptimistic
                    ? 'text-primary'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                )}
                aria-label={watchingOptimistic ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Bookmark className={cn('h-4 w-4', watchingOptimistic && 'fill-current')} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">{watchingOptimistic ? 'Watching' : 'Watch'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </td>

      {/* Action */}
      <td className="py-3 px-4">
        <Button
          onClick={handleCompareClick}
          size="sm"
          variant="outline"
          className="h-8 text-xs"
        >
          {ctaText}
        </Button>
      </td>
    </tr>
  )
}

/**
 * ResultRowV2Skeleton - Loading placeholder
 */
export function ResultRowV2Skeleton() {
  return (
    <tr className="border-b border-border">
      <td className="py-3 px-4">
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      </td>
      <td className="py-3 px-4">
        <div className="h-5 w-12 bg-muted rounded animate-pulse" />
      </td>
      <td className="py-3 px-4">
        <div className="h-4 w-16 bg-muted rounded animate-pulse ml-auto" />
      </td>
      <td className="py-3 px-4">
        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
      </td>
      <td className="py-3 px-4">
        <div className="h-5 w-14 bg-muted rounded animate-pulse mx-auto" />
      </td>
      <td className="py-3 px-4">
        <div className="h-4 w-4 bg-muted rounded animate-pulse mx-auto" />
      </td>
      <td className="py-3 px-4">
        <div className="h-8 w-16 bg-muted rounded animate-pulse" />
      </td>
    </tr>
  )
}

// ============================================
// Table Header
// ============================================

type SortDirection = 'asc' | 'desc' | null

interface ResultTableHeaderV2Props {
  currentSort: 'relevance' | 'price_asc' | 'price_desc'
  onSortChange: (sort: string) => void
}

/**
 * Sortable column header
 */
function SortableHeader({
  children,
  isAsc,
  isDesc,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  isAsc: boolean
  isDesc: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <th
      className={cn(
        'py-3 px-4 cursor-pointer select-none hover:bg-muted/50 transition-colors',
        (isAsc || isDesc) && 'text-foreground',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        <span className="inline-flex flex-col text-[10px] leading-none">
          <ChevronUp
            className={cn(
              'h-3 w-3 -mb-1',
              isAsc ? 'text-foreground' : 'text-muted-foreground/30'
            )}
          />
          <ChevronDown
            className={cn(
              'h-3 w-3',
              isDesc ? 'text-foreground' : 'text-muted-foreground/30'
            )}
          />
        </span>
      </div>
    </th>
  )
}

/**
 * ResultTableHeaderV2 - Column headers with sorting
 */
export function ResultTableHeaderV2({
  currentSort,
  onSortChange,
}: ResultTableHeaderV2Props) {
  const handlePriceSort = () => {
    if (currentSort === 'price_asc') {
      onSortChange('price_desc')
    } else if (currentSort === 'price_desc') {
      onSortChange('relevance')
    } else {
      onSortChange('price_asc')
    }
  }

  return (
    <thead className="bg-muted/30">
      <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <th className="py-3 px-4">Product</th>
        <th className="py-3 px-4">Cal</th>
        <SortableHeader
          isAsc={currentSort === 'price_asc'}
          isDesc={currentSort === 'price_desc'}
          onClick={handlePriceSort}
          className="text-right"
        >
          $/rd
        </SortableHeader>
        <th className="py-3 px-4">Retailers</th>
        <th className="py-3 px-4 text-center">Stock</th>
        <th className="py-3 px-4 text-center">★</th>
        <th className="py-3 px-4">Action</th>
      </tr>
    </thead>
  )
}
