'use client'

import { SectionHeader } from './section-header'
import { SpotlightCard } from './spotlight-card'
import { WatchlistRow } from './watchlist-row'
import { AlertRow } from './alert-row'
import { ContextRow } from './context-row'
import { ColdStartModule } from './cold-start-module'
import type { DashboardV5Data } from './types'

interface DashboardV5Props {
  data: DashboardV5Data
}

/**
 * DashboardV5 - Main Dashboard Layout
 *
 * Per ADR-020 and dashboard-product-spec-v5.md:
 *
 * Sections (in order):
 * 1. Spotlight (optional, single item)
 * 2. Your Watchlist (always, max 10)
 * 3. Recent Price Movement (conditional, max 5)
 * 4. Back in Stock (conditional, max 5)
 * 5. Matches Your Gun Locker (conditional, max 5)
 *
 * Cold-start: If no watchlist and no gun locker, show onboarding module only.
 */
export function DashboardV5({ data }: DashboardV5Props) {
  const {
    spotlight,
    watchlist,
    priceMovement,
    backInStock,
    gunLockerMatches,
    hasGunLocker,
    lastUpdatedAt,
  } = data

  // Cold-start check: no watchlist and no gun locker
  const isColdStart = watchlist.totalCount === 0 && !hasGunLocker

  if (isColdStart) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <ColdStartModule />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-4xl mx-auto">
      {/* 1. Spotlight (optional) */}
      {spotlight && (
        <section>
          <SpotlightCard data={spotlight} />
        </section>
      )}

      {/* 2. Your Watchlist (always shown if not cold-start) */}
      <section>
        <SectionHeader
          title="Your Watchlist"
          subtitle="Prices we're monitoring for you"
          viewAllHref={watchlist.totalCount > 10 ? '/dashboard/watchlist' : undefined}
          viewAllLabel={watchlist.totalCount > 10 ? `View all (${watchlist.totalCount})` : undefined}
        />

        {watchlist.items.length > 0 ? (
          <div className="divide-y divide-border/50">
            {watchlist.items.slice(0, 10).map((item) => (
              <WatchlistRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState message="No items in your watchlist yet." />
        )}

        {/* View all button for mobile (shows when > 10 items) */}
        {watchlist.totalCount > 10 && (
          <div className="mt-4 text-center sm:hidden">
            <a
              href="/dashboard/watchlist"
              className="text-sm text-primary hover:underline"
            >
              View all {watchlist.totalCount} items &rarr;
            </a>
          </div>
        )}
      </section>

      {/* 3. Recent Price Movement (conditional) */}
      {priceMovement.length > 0 && (
        <section>
          <SectionHeader
            title="Recent Price Movement"
            subtitle="Notable price changes observed in the last 90 days"
          />

          <div className="divide-y divide-border/50">
            {priceMovement.slice(0, 5).map((item) => (
              <AlertRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* 4. Back in Stock (conditional) */}
      {backInStock.length > 0 && (
        <section>
          <SectionHeader
            title="Back in Stock"
            subtitle="Items that recently became available again"
          />

          <div className="divide-y divide-border/50">
            {backInStock.slice(0, 5).map((item) => (
              <AlertRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Matches Your Gun Locker (conditional - only if gun locker configured) */}
      {hasGunLocker && gunLockerMatches.length > 0 && (
        <section>
          <SectionHeader
            title="Matches Your Gun Locker"
            subtitle="Matches calibers you've saved"
          />

          <div className="divide-y divide-border/50">
            {gunLockerMatches.slice(0, 5).map((item) => (
              <ContextRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* Footer timestamp */}
      <footer className="pt-4 border-t border-border/30">
        <p className="text-xs text-muted-foreground/60 text-center">
          Last updated: {formatTimestamp(lastUpdatedAt)}
        </p>
      </footer>
    </div>
  )
}

/**
 * Empty state for sections with no data
 */
function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </p>
  )
}

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return 'Unknown'
  }
}
