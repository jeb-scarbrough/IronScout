'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, ChevronDown, ChevronUp, Bell, BellOff } from 'lucide-react'
import { trackAffiliateClick, trackTrackToggle, trackDetailsToggle } from '@/lib/analytics'
import { toast } from 'sonner'

/**
 * ResultCard Props - Exact spec contract
 *
 * Primary KPI: Affiliate Clicks
 * Every card optimizes for outbound retailer clicks.
 * Tracking is a retention affordance, not the goal.
 */
export interface ResultCardProps {
  id: string

  pricePerRound: number
  currency?: 'USD'

  inStock?: boolean

  productTitle: string
  retailerName: string
  retailerUrl: string

  caliber: string
  grain?: string | number
  caseMaterial?: string

  isTracked: boolean

  /** Reserved for future insight line (e.g., "Lowest price this week") */
  topSlot?: React.ReactNode

  /** Placement context for analytics */
  placement?: 'search' | 'for_you' | 'product_detail'

  onTrackToggle: (id: string) => void
  onPrimaryClick?: (id: string) => void
}

/**
 * Format price per round with consistent precision
 */
function formatPricePerRound(price: number): string {
  // Always show 3 decimal places for per-round pricing
  return `$${price.toFixed(3)}`
}

/**
 * Format price per 1,000 rounds
 */
function formatPer1000(pricePerRound: number): string {
  const per1000 = pricePerRound * 1000
  // Use 2 decimal places for bulk pricing
  return `$${per1000.toFixed(2)}`
}

/**
 * ResultCard Component
 *
 * Hierarchy (non-negotiable):
 * 1. (Reserved) Insight slot - empty in v1
 * 2. Price block (largest visual element)
 * 3. Primary CTA: View at retailer
 * 4. Secondary CTA: Track price
 * 5. Availability cue
 * 6. Details (collapsed)
 */
export function ResultCard({
  id,
  pricePerRound,
  currency = 'USD',
  inStock,
  productTitle,
  retailerName,
  retailerUrl,
  caliber,
  grain,
  caseMaterial,
  isTracked,
  topSlot,
  placement = 'search',
  onTrackToggle,
  onPrimaryClick,
}: ResultCardProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [trackingOptimistic, setTrackingOptimistic] = useState(isTracked)

  // Validate retailer URL
  const isValidUrl = retailerUrl && retailerUrl.startsWith('http')

  // Handle primary CTA click
  const handlePrimaryClick = useCallback(() => {
    // Track analytics event
    trackAffiliateClick(id, retailerName, pricePerRound, placement)

    // Call optional callback
    if (onPrimaryClick) {
      onPrimaryClick(id)
    }

    // Open in new tab
    if (isValidUrl) {
      window.open(retailerUrl, '_blank', 'noopener,noreferrer')
    }
  }, [id, retailerName, pricePerRound, placement, onPrimaryClick, isValidUrl, retailerUrl])

  // Handle track toggle with optimistic update
  const handleTrackToggle = useCallback(() => {
    const nextState = !trackingOptimistic
    setTrackingOptimistic(nextState)

    // Track analytics event
    trackTrackToggle(id, nextState)

    // Show toast feedback
    toast.success(nextState ? 'Price tracking enabled' : 'Price tracking removed', {
      duration: 2000,
    })

    // Call parent handler
    onTrackToggle(id)
  }, [id, trackingOptimistic, onTrackToggle])

  // Handle details toggle
  const handleDetailsToggle = useCallback(() => {
    const nextState = !detailsExpanded
    setDetailsExpanded(nextState)
    trackDetailsToggle(id, nextState)
  }, [id, detailsExpanded])

  return (
    <Card className="bg-card border-border overflow-hidden hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* 1. Reserved Insight Slot - only render if provided */}
        {topSlot && (
          <div className="pb-2 border-b border-border">
            {topSlot}
          </div>
        )}

        {/* 2. Price Block - largest visual element */}
        <div className="space-y-0.5">
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
            {formatPricePerRound(pricePerRound)} <span className="text-sm font-normal text-muted-foreground">/ rd</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatPer1000(pricePerRound)} per 1,000 rounds
          </div>
        </div>

        {/* 3. Primary CTA: View at retailer */}
        <Button
          onClick={handlePrimaryClick}
          disabled={!isValidUrl}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          View at retailer
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>

        {/* 4. Secondary CTA: Track price */}
        <Button
          variant="ghost"
          onClick={handleTrackToggle}
          className={cn(
            'w-full h-9 text-sm font-normal',
            trackingOptimistic
              ? 'text-primary hover:text-primary/80'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {trackingOptimistic ? (
            <>
              <BellOff className="mr-2 h-4 w-4" />
              Stop tracking
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Track price
            </>
          )}
        </Button>

        {/* 5. Availability Cue - muted text, no badges, no color drama */}
        {inStock !== undefined && (
          <p className="text-xs text-muted-foreground text-center">
            {inStock ? 'In stock' : 'Out of stock'}
          </p>
        )}

        {/* 6. Details - collapsed by default */}
        <div className="pt-2 border-t border-border">
          <button
            onClick={handleDetailsToggle}
            className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Details</span>
            {detailsExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {detailsExpanded && (
            <div className="mt-3 space-y-1.5 text-sm animate-in slide-in-from-top-2 duration-200">
              {/* Product title */}
              <p className="font-medium text-foreground leading-tight">
                {productTitle}
              </p>

              {/* Retailer name */}
              <p className="text-muted-foreground">
                {retailerName}
              </p>

              {/* Specs: Caliber, Grain, Case Material */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{caliber}</span>
                {grain && <span>{grain}gr</span>}
                {caseMaterial && <span>{caseMaterial}</span>}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * ResultCardSkeleton - Loading placeholder
 */
export function ResultCardSkeleton() {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Price skeleton */}
        <div className="space-y-1">
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>

        {/* Primary CTA skeleton */}
        <div className="h-11 w-full bg-muted rounded animate-pulse" />

        {/* Secondary CTA skeleton */}
        <div className="h-9 w-full bg-muted/50 rounded animate-pulse" />

        {/* Details skeleton */}
        <div className="pt-2 border-t border-border">
          <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
