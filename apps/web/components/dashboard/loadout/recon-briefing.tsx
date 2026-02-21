'use client'

import { Zap, TrendingDown, PackageCheck, ArrowDownRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WatchingItemWithPrice } from '@/hooks/use-loadout'
import type { AlertHistoryEntry } from '@/lib/api'
import { useRecentChanges, type RecentChange } from '@/hooks/use-recent-changes'

// ============================================================================
// TYPES
// ============================================================================

interface ReconBriefingProps {
  watchingItems: WatchingItemWithPrice[]
  recentAlerts: AlertHistoryEntry[]
  onCompareClick: (item: WatchingItemWithPrice) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ReconBriefing — "What Changed" section at the top of the Recon dashboard.
 *
 * Surfaces recent price drops, stock changes, and 90-day lows in a compact,
 * scannable format. Renders nothing when there are no changes.
 */
export function ReconBriefing({
  watchingItems,
  recentAlerts,
  onCompareClick,
}: ReconBriefingProps) {
  const changes = useRecentChanges(watchingItems, recentAlerts)

  if (changes.length === 0) return null

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Zap className="h-4 w-4 text-primary" />
            What Changed
          </CardTitle>
          <Badge variant="secondary" className="text-xs font-normal">
            {changes.length} {changes.length === 1 ? 'update' : 'updates'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {changes.map((change) => (
            <ChangeRow
              key={change.item.id}
              change={change}
              onCompareClick={onCompareClick}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// CHANGE ROW
// ============================================================================

interface ChangeRowProps {
  change: RecentChange
  onCompareClick: (item: WatchingItemWithPrice) => void
}

function ChangeRow({ change, onCompareClick }: ChangeRowProps) {
  const { item, changeType, enrichment, description } = change
  const Icon = CHANGE_ICONS[changeType]
  const colorClass = CHANGE_COLORS[changeType]

  // Build attributes line
  const attrs = [
    item.caliber,
    item.grainWeight ? `${item.grainWeight}gr` : null,
    item.bulletType,
  ]
    .filter(Boolean)
    .join(' \u00b7 ')

  const timeAgo = enrichment?.triggeredAt
    ? formatTimeAgo(new Date(enrichment.triggeredAt))
    : null

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
      {/* Icon */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          colorClass
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        {(attrs || timeAgo) && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {attrs}
            {attrs && timeAgo && ' \u00b7 '}
            {timeAgo}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        {item.inStock && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCompareClick(item)}
          >
            Compare prices
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// CONFIG
// ============================================================================

const CHANGE_ICONS: Record<string, typeof TrendingDown> = {
  'lowest-90-days': ArrowDownRight,
  'back-in-stock': PackageCheck,
  'price-moved': TrendingDown,
}

const CHANGE_COLORS: Record<string, string> = {
  'lowest-90-days': 'bg-emerald-500/10 text-emerald-500',
  'back-in-stock': 'bg-blue-500/10 text-blue-500',
  'price-moved': 'bg-amber-500/10 text-amber-500',
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

export default ReconBriefing
