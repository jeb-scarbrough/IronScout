'use client'

import { useState, useMemo, useCallback } from 'react'
import { ArrowLeft, Bookmark, ArrowUpRight, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { trackAffiliateClick } from '@/lib/analytics'
import type {
  RetailerPanelProps,
  RetailerPrice,
  RetailerSortOption,
} from './types'
import {
  formatShippingInfo,
  formatPrice,
  sortRetailers,
  RETAILER_SORT_OPTIONS,
} from './types'

/**
 * RetailerPanel - Multi-retailer comparison drawer
 *
 * Per search-results-ux-spec.md:
 * - Shows all retailers for a single product
 * - Sortable by price, retailer name, stock status
 * - Hide OOS filter
 * - No recommendation language
 */
export function RetailerPanel({
  isOpen,
  onClose,
  product,
  retailers,
  isWatched,
  onWatchToggle,
}: RetailerPanelProps) {
  const [sortBy, setSortBy] = useState<RetailerSortOption>('price_asc')
  const [hideOutOfStock, setHideOutOfStock] = useState(false)

  // Sort and filter retailers
  const displayRetailers = useMemo(() => {
    let filtered = [...retailers]

    if (hideOutOfStock) {
      filtered = filtered.filter((r) => r.inStock)
    }

    return sortRetailers(filtered, sortBy)
  }, [retailers, sortBy, hideOutOfStock])

  const oosCount = retailers.filter((r) => !r.inStock).length
  const allFiltered = hideOutOfStock && displayRetailers.length === 0

  const handleWatchToggle = useCallback(() => {
    if (product && onWatchToggle) {
      onWatchToggle(product.id)
    }
  }, [product, onWatchToggle])

  // Build attributes string
  const attributesLine = product
    ? [
        product.grainWeight ? `${product.grainWeight}gr` : null,
        product.bulletType,
        product.caseMaterial,
        product.roundCount ? `${product.roundCount} rounds` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  if (!product) return null

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {/* Header */}
        <SheetHeader className="space-y-0">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            {onWatchToggle && (
              <button
                onClick={handleWatchToggle}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors',
                  isWatched
                    ? 'text-primary bg-primary/10 hover:bg-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Bookmark
                  className={cn('h-4 w-4', isWatched && 'fill-current')}
                />
                <span>{isWatched ? 'Watching' : 'Watch'}</span>
              </button>
            )}
          </div>
          <div className="pt-4">
            <SheetTitle className="text-left">{product.name}</SheetTitle>
            {attributesLine && (
              <SheetDescription className="text-left mt-1">
                {attributesLine}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        {/* Controls */}
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {retailers.length} {retailers.length === 1 ? 'retailer' : 'retailers'}
            </span>
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as RetailerSortOption)}
            >
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {RETAILER_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {oosCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={hideOutOfStock}
                onChange={(e) => setHideOutOfStock(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-muted-foreground">
                Hide out of stock
                <span className="text-muted-foreground/60 ml-1">({oosCount})</span>
              </span>
            </label>
          )}
        </div>

        {/* Retailer List */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {retailers.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground font-medium">
                No current listings
              </p>
              <p className="text-sm text-muted-foreground/70 mt-2 max-w-[240px]">
                We haven't found this product at any tracked retailer recently.
              </p>
              {onWatchToggle && !isWatched && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleWatchToggle}
                >
                  Watch for availability
                </Button>
              )}
            </div>
          ) : allFiltered ? (
            // All filtered out
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                All {retailers.length} retailers are out of stock
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setHideOutOfStock(false)}
              >
                Show all retailers
              </Button>
            </div>
          ) : (
            // Retailer rows
            <div className="space-y-2">
              {displayRetailers.map((retailer) => (
                <RetailerRow
                  key={retailer.retailerId}
                  retailer={retailer}
                  productId={product.id}
                  roundCount={product.roundCount}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter>
          <Button
            variant="ghost"
            className="w-full"
            asChild
          >
            <a href={`/products/${product.id}`}>
              View Product Details
            </a>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/**
 * RetailerRow - Individual retailer in the panel
 */
interface RetailerRowProps {
  retailer: RetailerPrice
  productId: string
  roundCount?: number
}

function RetailerRow({ retailer, productId, roundCount }: RetailerRowProps) {
  const handleViewClick = useCallback(() => {
    trackAffiliateClick(productId, retailer.retailerName, retailer.pricePerRound, 'panel')
    window.open(retailer.url, '_blank', 'noopener,noreferrer')
  }, [productId, retailer])

  const shippingText = formatShippingInfo(retailer.shippingInfo)

  return (
    <div
      className={cn(
        'p-3 rounded-lg border bg-card',
        !retailer.inStock && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">
            {retailer.retailerName}
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span
              className={cn(
                'font-medium',
                retailer.inStock ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {retailer.inStock ? 'In Stock' : 'Out of Stock'}
            </span>
            {shippingText && (
              <>
                <span className="opacity-40">·</span>
                <span>{shippingText}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="font-mono font-bold text-foreground">
              {formatPrice(retailer.pricePerRound)}
            </span>
            <span className="text-xs text-muted-foreground ml-0.5">/ rd</span>
            <p className="text-xs text-muted-foreground">
              {formatPrice(retailer.totalPrice)} total
              {roundCount ? ` · ${roundCount} rds` : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={handleViewClick}
          >
            View
            <ArrowUpRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
