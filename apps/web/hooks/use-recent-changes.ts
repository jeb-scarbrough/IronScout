import { useMemo } from 'react'
import type { WatchingItemWithPrice } from './use-loadout'
import { formatPriceRange } from './use-loadout'
import type { AlertHistoryEntry } from '@/lib/api'

// ============================================================================
// TYPES
// ============================================================================

export interface RecentChange {
  item: WatchingItemWithPrice
  changeType: 'lowest-90-days' | 'back-in-stock' | 'price-moved'
  enrichment: {
    oldPrice?: number
    newPrice?: number
    retailer?: string | null
    triggeredAt?: string
  } | null
  description: string
}

// Status priority for sorting (lower = higher priority)
const STATUS_PRIORITY: Record<string, number> = {
  'lowest-90-days': 0,
  'back-in-stock': 1,
  'price-moved': 2,
}

const MAX_CHANGES = 5
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// ============================================================================
// HOOK
// ============================================================================

/**
 * Merges loadout watching item statuses with recent alert history
 * to produce a prioritized list of recent changes.
 *
 * Pure transformation — no API calls. Both inputs come from the parent.
 */
export function useRecentChanges(
  watchingItems: WatchingItemWithPrice[],
  recentAlerts: AlertHistoryEntry[]
): RecentChange[] {
  return useMemo(() => {
    // 1. Filter watching items that have a status (= something changed)
    const changedItems = watchingItems.filter((item) => item.status !== null)

    if (changedItems.length === 0) return []

    // 2. Build a lookup from alert history (productId → most recent alert)
    //    Filter to last 7 days only
    const cutoff = Date.now() - SEVEN_DAYS_MS
    const alertsByProduct = new Map<string, AlertHistoryEntry>()
    for (const alert of recentAlerts) {
      const ts = new Date(alert.triggeredAt).getTime()
      if (ts < cutoff) continue

      const existing = alertsByProduct.get(alert.productId)
      if (!existing || new Date(alert.triggeredAt) > new Date(existing.triggeredAt)) {
        alertsByProduct.set(alert.productId, alert)
      }
    }

    // 3. Build enriched changes
    const changes: RecentChange[] = changedItems.map((item) => {
      const alert = alertsByProduct.get(item.productId)
      const enrichment = alert
        ? {
            oldPrice: alert.metadata.oldPrice,
            newPrice: alert.metadata.newPrice,
            retailer: alert.metadata.retailer,
            triggeredAt: alert.triggeredAt,
          }
        : null

      const description = buildDescription(item, enrichment)

      return {
        item,
        changeType: item.status!,
        enrichment,
        description,
      }
    })

    // 4. Sort by priority, then by whether enrichment exists (enriched first)
    changes.sort((a, b) => {
      const pa = STATUS_PRIORITY[a.changeType] ?? 99
      const pb = STATUS_PRIORITY[b.changeType] ?? 99
      if (pa !== pb) return pa - pb
      // Enriched items first (they have richer context)
      if (a.enrichment && !b.enrichment) return -1
      if (!a.enrichment && b.enrichment) return 1
      return 0
    })

    return changes.slice(0, MAX_CHANGES)
  }, [watchingItems, recentAlerts])
}

// ============================================================================
// DESCRIPTION BUILDER
// ============================================================================

function buildDescription(
  item: WatchingItemWithPrice,
  enrichment: RecentChange['enrichment']
): string {
  const roundCount = item.roundCount ?? 1

  switch (item.status) {
    case 'lowest-90-days': {
      if (enrichment?.newPrice != null && enrichment.oldPrice != null) {
        const newPpr = enrichment.newPrice / roundCount
        const oldPpr = enrichment.oldPrice / roundCount
        return `Dropped to $${newPpr.toFixed(2)}/rd from $${oldPpr.toFixed(2)} \u2014 lowest in 90 days`
      }
      if (item.priceRange) {
        return `At 90-day low \u2014 ${formatPriceRange(item.priceRange, { showRetailerCount: true })}`
      }
      return 'At 90-day low'
    }

    case 'back-in-stock': {
      if (enrichment?.retailer && enrichment.newPrice != null) {
        const ppr = enrichment.newPrice / roundCount
        return `Back in stock at ${enrichment.retailer} \u2014 $${ppr.toFixed(2)}/rd`
      }
      if (item.priceRange) {
        return `Back in stock \u2014 ${formatPriceRange(item.priceRange, { showRetailerCount: true })}`
      }
      return 'Back in stock'
    }

    case 'price-moved': {
      if (enrichment?.newPrice != null && enrichment.oldPrice != null) {
        const newPpr = enrichment.newPrice / roundCount
        const oldPpr = enrichment.oldPrice / roundCount
        const direction = newPpr < oldPpr ? 'down' : 'up'
        return `Price moved ${direction} to $${newPpr.toFixed(2)}/rd from $${oldPpr.toFixed(2)}`
      }
      if (item.priceRange) {
        return `Price moved \u2014 ${formatPriceRange(item.priceRange, { showRetailerCount: true })}`
      }
      return 'Price moved'
    }

    default:
      return 'Changed'
  }
}
