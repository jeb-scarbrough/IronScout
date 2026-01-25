'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// Core components
import { SpotlightNotice, SpotlightReason } from './spotlight-notice'
import { WatchlistTable, WatchlistTableItem } from './watchlist-table'
import { PriceMovementAccordion, PriceChange } from './price-movement-accordion'
import { ColdStartModule } from './cold-start-module'

// Ambient vitality components
import { ActiveMonitoringHeader, selectMonitoringVariant } from './active-monitoring-header'
import { MarketPulseStrip, CaliberTrend } from './market-pulse-strip'
import { CoverageContext, CoverageObservation } from './coverage-context'

/**
 * Dashboard v5 Vital Data Structure
 *
 * Per dashboard-v5-ambient-vitality.md
 */
export interface DashboardV5VitalData {
  // Monitoring status (for header)
  monitoring: {
    isActive: boolean
    lastScanAt: string // ISO timestamp
    scansToday: number
    retailersChecked: number
  }

  // Market pulse (caliber trends)
  caliberTrends: CaliberTrend[]

  // Spotlight signal (ephemeral)
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

  // Price changes (for collapsed accordion)
  priceChanges: PriceChange[]

  // Coverage context (footer vitality)
  coverage: {
    observation: CoverageObservation | null
    stockSummary: {
      inStock: number
      total: number
    } | null
  }
}

interface DashboardV5VitalProps {
  data: DashboardV5VitalData
  onSpotlightDismiss?: () => void
}

/**
 * DashboardV5Vital - Implementation with Ambient Vitality
 *
 * Per dashboard-v5-ambient-vitality.md:
 *
 * Structure:
 * 1. Active Monitoring Header (always) - "● Actively monitoring"
 * 2. Spotlight Notice (ephemeral) - Single-line, dismissible
 * 3. Market Pulse Strip (always) - Caliber-level trends
 * 4. Watchlist Table (primary surface) - Dense, status-first
 * 5. Activity Log (collapsed) - Price changes accordion
 * 6. Coverage Context (always) - Rotating observations
 *
 * Invariants:
 * - Page feels "alive" even on quiet days
 * - No urgency, no recommendations
 * - Monitoring feels active, not passive
 * - Each visit provides new information
 */
export function DashboardV5Vital({ data, onSpotlightDismiss }: DashboardV5VitalProps) {
  const {
    monitoring,
    caliberTrends,
    spotlight,
    watchlist,
    priceChanges,
    coverage,
  } = data

  // Cold-start check
  const isColdStart = watchlist.totalCount === 0

  if (isColdStart) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <ColdStartModule />
      </div>
    )
  }

  // Select monitoring header variant (rotates by day)
  const monitoringVariant = selectMonitoringVariant()

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4">
      {/* ─────────────────────────────────────────────────────────────
          HEADER REGION (Persistent - Active Monitoring)
          ───────────────────────────────────────────────────────────── */}
      <ActiveMonitoringHeader
        title="Your Watchlist"
        isActivelyMonitoring={monitoring.isActive}
        lastScanAt={monitoring.lastScanAt}
        scansToday={monitoring.scansToday}
        retailersChecked={monitoring.retailersChecked}
        variant={monitoringVariant}
      />

      {/* ─────────────────────────────────────────────────────────────
          SPOTLIGHT (Ephemeral Notice)
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
          MARKET PULSE (Ambient Vitality - Caliber Trends)
          ───────────────────────────────────────────────────────────── */}
      {caliberTrends.length > 0 && (
        <MarketPulseStrip
          calibers={caliberTrends}
          maxVisible={4}
          className="py-2 px-3 bg-muted/30 rounded-md"
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          WATCHLIST TABLE (Primary Surface)
          ───────────────────────────────────────────────────────────── */}
      <section>
        <WatchlistTable items={watchlist.items} maxVisible={10} />

        {/* View all link */}
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
          ACTIVITY LOG (Collapsed Accordion)
          ───────────────────────────────────────────────────────────── */}
      <PriceMovementAccordion changes={priceChanges} />

      {/* Show explicit "no changes" message when appropriate */}
      {priceChanges.length === 0 && (
        <div className="border-t border-border/30 py-3">
          <p className="text-sm text-muted-foreground">
            No price changes in the last 24 hours
          </p>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FOOTER (Coverage Context - Persistent Vitality)
          ───────────────────────────────────────────────────────────── */}
      <CoverageContext
        observation={coverage.observation}
        stockSummary={coverage.stockSummary ?? undefined}
      />
    </div>
  )
}

/**
 * Loading skeleton
 */
export function DashboardV5VitalSkeleton() {
  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-6 w-40 bg-muted rounded" />
        <div className="h-4 w-56 bg-muted rounded mt-2" />
      </div>

      {/* Market pulse */}
      <div className="h-8 bg-muted/50 rounded-md" />

      {/* Table rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 bg-muted rounded" />
        ))}
      </div>

      {/* Footer */}
      <div className="h-4 w-48 bg-muted rounded mx-auto mt-4" />
    </div>
  )
}
