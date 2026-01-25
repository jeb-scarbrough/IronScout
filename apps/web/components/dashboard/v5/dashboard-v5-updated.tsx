'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpotlightNotice, SpotlightReason } from './spotlight-notice'
import { MonitoringSummary } from './monitoring-summary'
import { WatchlistTable, WatchlistTableItem } from './watchlist-table'
import { PriceMovementAccordion, PriceChange } from './price-movement-accordion'
import { MarketContext, MarketObservation } from './market-context'
import { ColdStartModule } from './cold-start-module'

/**
 * Dashboard v5 Data Structure
 *
 * Per dashboard-v5-implementation.md
 */
export interface DashboardV5UpdatedData {
  // Monitoring summary (always present if items exist)
  monitoringSummary: {
    itemCount: number
    retailerCount: number
    lastUpdated: string // ISO timestamp
  } | null

  // Spotlight signal (ephemeral, max 1)
  spotlight: {
    productId: string
    productName: string
    reason: SpotlightReason
    percentChange?: number
  } | null

  // Watchlist items
  watchlist: {
    items: WatchlistTableItem[]
    totalCount: number
  }

  // Recent price changes (for accordion)
  priceChanges: PriceChange[]

  // Market context (footer vitality)
  marketContext: {
    observation: MarketObservation | null
    stockSummary: {
      inStock: number
      total: number
    } | null
  }
}

interface DashboardV5UpdatedProps {
  data: DashboardV5UpdatedData
  onSpotlightDismiss?: () => void
}

/**
 * DashboardV5Updated - Implementation per v5-patch-001
 *
 * Structure:
 * 1. Header Region (persistent): Title + Monitoring Summary
 * 2. Spotlight (ephemeral): Single-line notice, dismissible
 * 3. Watchlist Table (primary surface): Dense table, silence by default
 * 4. Price Movement (collapsed): Accordion, not a feed
 * 5. Footer (persistent): Market context vitality
 *
 * Invariants:
 * - Watchlist is visually dominant
 * - Spotlight is NOT a hero
 * - No feed patterns
 * - Silence is default
 * - Vitality ensures page never feels dead
 */
export function DashboardV5Updated({ data, onSpotlightDismiss }: DashboardV5UpdatedProps) {
  const {
    monitoringSummary,
    spotlight,
    watchlist,
    priceChanges,
    marketContext,
  } = data

  // Cold-start check: no watchlist items
  const isColdStart = watchlist.totalCount === 0

  if (isColdStart) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <ColdStartModule />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          HEADER REGION (Persistent)
          ───────────────────────────────────────────────────────────── */}
      <header>
        <h1 className="text-xl font-semibold text-foreground">Your Watchlist</h1>
        {monitoringSummary && (
          <MonitoringSummary
            itemCount={monitoringSummary.itemCount}
            retailerCount={monitoringSummary.retailerCount}
            lastUpdated={monitoringSummary.lastUpdated}
            className="mt-1"
          />
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          SPOTLIGHT REGION (Ephemeral)
          ───────────────────────────────────────────────────────────── */}
      {spotlight && (
        <SpotlightNotice
          productName={spotlight.productName}
          productId={spotlight.productId}
          reason={spotlight.reason}
          percentChange={spotlight.percentChange}
          onDismiss={onSpotlightDismiss}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          WATCHLIST TABLE (Primary Surface)
          ───────────────────────────────────────────────────────────── */}
      <section>
        <WatchlistTable items={watchlist.items} maxVisible={10} />

        {/* View all link (if more than 10 items) */}
        {watchlist.totalCount > 10 && (
          <div className="mt-4">
            <Link
              href="/dashboard/saved"
              className={cn(
                'inline-flex items-center text-sm text-muted-foreground',
                'hover:text-foreground transition-colors'
              )}
            >
              View all {watchlist.totalCount} items
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          PRICE MOVEMENT (Collapsed Accordion)
          ───────────────────────────────────────────────────────────── */}
      {priceChanges.length > 0 && (
        <PriceMovementAccordion changes={priceChanges} />
      )}

      {/* ─────────────────────────────────────────────────────────────
          FOOTER REGION (Persistent Vitality)
          ───────────────────────────────────────────────────────────── */}
      <MarketContext
        observation={marketContext.observation}
        stockSummary={marketContext.stockSummary ?? undefined}
        className="border-t border-border/30"
      />
    </div>
  )
}

/**
 * Skeleton loading state
 */
export function DashboardV5UpdatedSkeleton() {
  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-6 w-40 bg-muted rounded" />
        <div className="h-4 w-64 bg-muted rounded mt-2" />
      </div>

      {/* Table rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>

      {/* Footer */}
      <div className="h-4 w-48 bg-muted rounded mx-auto" />
    </div>
  )
}
