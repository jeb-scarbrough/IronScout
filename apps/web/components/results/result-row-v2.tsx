'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Bookmark, ChevronUp, ChevronDown, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { trackTrackToggle, trackRetailerClick, extractDomain } from '@/lib/analytics'
import { toast } from 'sonner'
import type { ResultRowV2Props, RetailerPrice } from './types'
import { formatPrice, truncate } from './types'
import { BADGE_CONFIG } from '@/lib/api'
import type { PerformanceBadge } from '@/lib/api'

/** Max performance badges to show inline in grid */
const MAX_GRID_BADGES = 2

/** Max retailers shown in hover preview */
const MAX_PREVIEW_RETAILERS = 5

export function ResultRowV2({
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
  lowestPricePerRound,
  retailerCount,
  anyInStock,
  isWatched,
  onWatchToggle,
  onCompareClick,
  onHoverStart,
  onHoverEnd,
}: ResultRowV2Props) {
  const [watchingOptimistic, setWatchingOptimistic] = useState(isWatched)

  useEffect(() => {
    setWatchingOptimistic(isWatched)
  }, [isWatched])

  const handleWatchToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextState = !watchingOptimistic

    setWatchingOptimistic(nextState)
    trackTrackToggle(id, nextState)

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
      setWatchingOptimistic(!nextState)
    }
  }, [id, watchingOptimistic, onWatchToggle])

  const handleRowClick = useCallback(() => {
    onCompareClick(id)
  }, [id, onCompareClick])

  // First retailer name for single-retailer display
  const singleRetailerName = retailerCount === 1 && retailers.length > 0
    ? retailers[0].retailerName
    : null

  return (
    <tr
      onClick={handleRowClick}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      className={cn(
        'border-b border-border hover:bg-muted/50 transition-colors cursor-pointer relative',
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
                <span className="font-medium text-foreground cursor-pointer leading-snug">
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

      {/* $/rd — stock status merged into price color */}
      <td className="py-3 px-4 text-right">
        <span className={cn(
          'font-mono font-bold text-lg',
          anyInStock
            ? 'text-emerald-500 dark:text-emerald-400'
            : 'text-muted-foreground line-through decoration-1'
        )}>
          {formatPrice(lowestPricePerRound)}
        </span>
        <span className="text-xs text-muted-foreground ml-0.5">/rd</span>
      </td>

      {/* Retailers — show name for single, count for multi */}
      <td className="py-3 px-4">
        {singleRetailerName ? (
          <span className="text-sm text-muted-foreground">{singleRetailerName}</span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onCompareClick(id) }}
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            {retailerCount} retailers
          </button>
        )}
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

    </tr>
  )
}

/**
 * HoverPreviewRow — Renders as a separate <tr> to keep valid table HTML.
 * Called from parent grid, not inline in ResultRowV2, to avoid nesting issues.
 * However, for encapsulation we keep it co-located and export for parent use.
 */
export function HoverPreviewRow({
  show,
  productTitle,
  caliber,
  bulletType,
  grainWeight,
  caseMaterial,
  roundCount,
  retailers,
  productId,
  onMouseEnter,
  onMouseLeave,
}: {
  show: boolean
  productTitle: string
  caliber: string
  bulletType?: string
  grainWeight?: number
  caseMaterial?: string
  roundCount?: number
  retailers: RetailerPrice[]
  productId: string
  /** Keep preview visible when mouse moves onto it */
  onMouseEnter?: () => void
  /** Dismiss preview when mouse leaves it */
  onMouseLeave?: () => void
}) {
  if (!show || retailers.length === 0) return null

  return (
    <tr className="border-0" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <td colSpan={5} className="p-0 border-0">
        <HoverPreview
          productTitle={productTitle}
          caliber={caliber}
          bulletType={bulletType}
          grainWeight={grainWeight}
          caseMaterial={caseMaterial}
          roundCount={roundCount}
          retailers={retailers}
          productId={productId}
        />
      </td>
    </tr>
  )
}

/**
 * HoverPreview — Quick Glance floating card below grid row
 */
function HoverPreview({
  productTitle,
  caliber,
  bulletType,
  grainWeight,
  caseMaterial,
  roundCount,
  retailers,
  productId,
}: {
  productTitle: string
  caliber: string
  bulletType?: string
  grainWeight?: number
  caseMaterial?: string
  roundCount?: number
  retailers: RetailerPrice[]
  productId: string
}) {
  const attrs = [
    caliber,
    grainWeight ? `${grainWeight}gr` : null,
    bulletType,
    caseMaterial,
    roundCount && roundCount > 1 ? `${roundCount.toLocaleString()} rds` : null,
  ].filter(Boolean)

  // Sort in-stock first by price, then OOS by price; cap to MAX_PREVIEW_RETAILERS
  const sortedRetailers = useMemo(() => {
    const inStock = retailers.filter((r) => r.inStock).sort((a, b) => a.pricePerRound - b.pricePerRound)
    const oos = retailers.filter((r) => !r.inStock).sort((a, b) => a.pricePerRound - b.pricePerRound)
    return [...inStock, ...oos].slice(0, MAX_PREVIEW_RETAILERS)
  }, [retailers])

  const handleRetailerClick = useCallback((retailer: RetailerPrice) => {
    if (!retailer.out_url) return
    trackRetailerClick({
      retailer: retailer.retailerName,
      product_id: productId,
      placement: 'hover_preview',
      destination_domain: extractDomain(retailer.url),
      price_per_round: retailer.pricePerRound,
      price_total: retailer.totalPrice,
      in_stock: retailer.inStock,
    })
    window.open(retailer.out_url, '_blank', 'noopener,noreferrer')
  }, [productId])

  return (
    <div
      className="bg-card border border-border rounded-lg shadow-lg p-4 mt-1 animate-in fade-in slide-in-from-top-1 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Title + Attributes */}
      <p className="font-semibold text-foreground text-sm leading-snug mb-0.5">
        {productTitle}
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {attrs.join(' \u00b7 ')}
      </p>

      {/* Retailer prices with direct buy links */}
      <div className="space-y-2">
        {sortedRetailers.map((r) => (
          <div
            key={r.retailerId}
            className={cn(
              'flex items-center justify-between gap-3 py-1.5 px-2 rounded',
              r.inStock ? 'hover:bg-muted/50' : 'opacity-50'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                r.inStock ? 'bg-emerald-500' : 'bg-red-400'
              )} />
              <span className="text-sm text-foreground truncate">{r.retailerName}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn(
                'font-mono font-bold text-sm',
                r.inStock ? 'text-emerald-500 dark:text-emerald-400' : 'text-muted-foreground'
              )}>
                {formatPrice(r.pricePerRound)}/rd
              </span>
              {r.inStock && r.out_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRetailerClick(r)
                  }}
                >
                  Buy
                  <ArrowUpRight className="h-3 w-3 ml-0.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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
        <div className="h-4 w-4 bg-muted rounded animate-pulse mx-auto" />
      </td>
    </tr>
  )
}

// ============================================
// Table Header
// ============================================

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
 *
 * Columns: Product | Cal | $/rd | Retailers | ★
 * Stock column removed — stock status is merged into price color.
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
        <th className="py-3 px-4 w-[45%]">Product</th>
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
        <th className="py-3 px-4 text-center">★</th>
      </tr>
    </thead>
  )
}
